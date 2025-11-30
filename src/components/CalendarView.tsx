
import React, { useState, useMemo } from 'react';
import { Task, TaskStatus } from '../types';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onCreateTaskForDate: (date: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, onTaskClick, onCreateTaskForDate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    // 0 = Sunday, 1 = Monday. We want 0 = Monday for European calendar
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const currentMonthName = currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  // Group tasks by date (dueDate or createdAt)
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach(task => {
      // Prefer dueDate, fallback to createdAt (YYYY-MM-DD)
      const rawDate = task.dueDate || task.createdAt;
      const dateKey = rawDate.split('T')[0];
      
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(task);
    });
    return map;
  }, [tasks]);

  const renderCalendarDays = () => {
    const days = [];
    const today = new Date().toISOString().split('T')[0];

    // Empty cells for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-[100px] bg-slate-50/50 border border-slate-100"></div>);
    }

    // Days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayTasks = tasksByDate[dateStr] || [];
      const isToday = dateStr === today;

      days.push(
        <div 
          key={day} 
          className={`min-h-[100px] bg-white border border-slate-100 p-2 relative group hover:bg-slate-50 transition-colors ${isToday ? 'bg-indigo-50/30' : ''}`}
          onClick={(e) => {
            // Only create if clicking the cell background, not a task
            if (e.target === e.currentTarget) {
              onCreateTaskForDate(dateStr);
            }
          }}
        >
          <div className="flex justify-between items-start mb-1">
            <span className={`text-sm font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
              {day}
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); onCreateTaskForDate(dateStr); }}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-opacity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-1">
            {dayTasks.map(task => {
              const statusColor = task.status === TaskStatus.DONE 
                ? 'bg-green-100 text-green-800 border-green-200 decoration-slate-500 line-through opacity-70' 
                : task.status === TaskStatus.IN_PROGRESS 
                ? 'bg-yellow-100 text-yellow-800 border-yellow-200' 
                : 'bg-indigo-100 text-indigo-800 border-indigo-200';

              return (
                <div 
                  key={task.id}
                  onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                  className={`text-[10px] px-1.5 py-1 rounded border cursor-pointer truncate font-medium hover:shadow-sm transition-shadow ${statusColor}`}
                  title={task.title}
                >
                  {task.title}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return days;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 capitalize flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-indigo-600" />
          {currentMonthName}
        </h2>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-sm font-medium hover:bg-slate-100 rounded-lg text-slate-600 border border-slate-200">
            Oggi
          </button>
          <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {renderCalendarDays()}
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Pill, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { mockMedications, mockAdherenceLog } from '../mockData';
import BottomNav from '../components/BottomNav';

const SchedulePage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'timeline'

  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  
  const daySchedule = useMemo(() => {
    const schedule = [];
    mockMedications.forEach(med => {
      if (med.schedule.frequency === 'daily') {
        med.schedule.times.forEach(time => {
          const log = mockAdherenceLog.find(
            l => l.medicationId === med.id && l.scheduledTime === time && l.date === selectedDateStr
          );
          schedule.push({
            ...med,
            scheduledTime: time,
            status: log?.status || 'pending',
            takenTime: log?.takenTime
          });
        });
      }
    });
    return schedule.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  }, [selectedDateStr]);

  const timeSlots = [
    { label: 'Morning', range: '06:00-12:00', items: daySchedule.filter(s => s.scheduledTime >= '06:00' && s.scheduledTime < '12:00') },
    { label: 'Afternoon', range: '12:00-18:00', items: daySchedule.filter(s => s.scheduledTime >= '12:00' && s.scheduledTime < '18:00') },
    { label: 'Evening', range: '18:00-22:00', items: daySchedule.filter(s => s.scheduledTime >= '18:00' && s.scheduledTime < '22:00') },
    { label: 'Night', range: '22:00-06:00', items: daySchedule.filter(s => s.scheduledTime >= '22:00' || s.scheduledTime < '06:00') }
  ];

  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    setSelectedDate(newDate);
  };

  const isToday = selectedDateStr === new Date().toISOString().split('T')[0];

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Schedule</h1>
          
          {/* View Toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              size="sm"
              variant={viewMode === 'timeline' ? 'default' : 'outline'}
              onClick={() => setViewMode('timeline')}
              className={viewMode === 'timeline' ? 'bg-blue-600 text-white' : ''}
            >
              Timeline
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              onClick={() => setViewMode('calendar')}
              className={viewMode === 'calendar' ? 'bg-blue-600 text-white' : ''}
            >
              Calendar
            </Button>
          </div>
          
          {/* Date Navigator */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <Button size="sm" variant="ghost" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="text-center">
              <p className="font-semibold text-gray-900">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
              {isToday && <p className="text-xs text-blue-600 font-medium">Today</p>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigateDate(1)}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {viewMode === 'calendar' ? (
          <Card className="p-4 mb-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md"
            />
          </Card>
        ) : null}

        {/* Timeline View */}
        <div className="space-y-4">
          {daySchedule.length === 0 ? (
            <Card className="p-8 text-center">
              <Clock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No medications scheduled</p>
            </Card>
          ) : (
            timeSlots.map((slot, index) => (
              slot.items.length > 0 && (
                <div key={index}>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <h3 className="font-semibold text-gray-900">{slot.label}</h3>
                    <span className="text-xs text-gray-500">{slot.range}</span>
                  </div>
                  <div className="space-y-2">
                    {slot.items.map((item, itemIndex) => (
                      <Card 
                        key={itemIndex}
                        className={`p-4 shadow-sm ${
                          item.status === 'taken' 
                            ? 'bg-green-50 border-green-200' 
                            : item.status === 'skipped'
                            ? 'bg-red-50 border-red-200'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: item.color + '30' }}>
                            <Pill className="w-6 h-6" style={{ color: item.color }} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{item.name}</h4>
                            <p className="text-sm text-gray-600">{item.dosage}</p>
                            <p className="text-xs text-gray-500 mt-1">{item.scheduledTime}</p>
                          </div>
                          <div className="flex-shrink-0">
                            {item.status === 'taken' ? (
                              <div className="flex flex-col items-center">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                                <span className="text-xs text-green-600 font-medium mt-1">Taken</span>
                              </div>
                            ) : item.status === 'skipped' ? (
                              <div className="flex flex-col items-center">
                                <XCircle className="w-6 h-6 text-red-600" />
                                <span className="text-xs text-red-600 font-medium mt-1">Skipped</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <Clock className="w-6 h-6 text-gray-400" />
                                <span className="text-xs text-gray-500 font-medium mt-1">Pending</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            ))
          )}
        </div>
      </div>

      <BottomNav active="schedule" />
    </div>
  );
};

export default SchedulePage;

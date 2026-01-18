import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Check } from 'lucide-react';

// Custom Toggle Switch Component
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  id: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, id }) => {
  return (
    <label className="toggle-switch" htmlFor={id}>
      <input 
        type="checkbox" 
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-slider"></span>
      <style>{`
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 60px;
          height: 34px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: .4s;
          border-radius: 34px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 26px;
          width: 26px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }

        input:checked + .toggle-slider {
          background-color: #2196F3;
        }

        input:focus + .toggle-slider {
          box-shadow: 0 0 1px #2196F3;
        }

        input:checked + .toggle-slider:before {
          transform: translateX(26px);
        }
      `}</style>
    </label>
  );
};

export function NotificationSettings() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [interviewReminders, setInterviewReminders] = useState(true);
  const [candidateUpdates, setCandidateUpdates] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // Load settings từ localStorage khi component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setEmailNotifications(settings.emailNotifications ?? true);
        setInterviewReminders(settings.interviewReminders ?? true);
        setCandidateUpdates(settings.candidateUpdates ?? false);
      } catch (error) {
        console.error('Error loading notification settings:', error);
      }
    }
  }, []);

  // Auto-save khi có thay đổi
  useEffect(() => {
    const settings = {
      emailNotifications,
      interviewReminders,
      candidateUpdates
    };
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
    
    // Hiển thị thông báo đã lưu
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [emailNotifications, interviewReminders, candidateUpdates]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Cài đặt Thông báo</CardTitle>
            <CardDescription>Quản lý các thông báo tự động của hệ thống.</CardDescription>
          </div>
          {showSaved && (
            <span className="text-sm text-green-600 flex items-center gap-1 bg-green-50 px-3 py-1 rounded-md">
              <Check className="h-4 w-4" />
              Đã lưu
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="email-notifications" className="font-medium cursor-pointer">
                Thông báo email
              </Label>
              <p className="text-sm text-muted-foreground">Nhận thông báo chung qua email.</p>
            </div>
            <ToggleSwitch
              id="email-notifications"
              checked={emailNotifications}
              onChange={setEmailNotifications}
            />
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="interview-reminders" className="font-medium cursor-pointer">
                Nhắc nhở phỏng vấn
              </Label>
              <p className="text-sm text-muted-foreground">Gửi email nhắc nhở trước buổi phỏng vấn.</p>
            </div>
            <ToggleSwitch
              id="interview-reminders"
              checked={interviewReminders}
              onChange={setInterviewReminders}
            />
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="candidate-updates" className="font-medium cursor-pointer">
                Cập nhật ứng viên
              </Label>
              <p className="text-sm text-muted-foreground">Thông báo khi có ứng viên mới nộp hồ sơ.</p>
            </div>
            <ToggleSwitch
              id="candidate-updates"
              checked={candidateUpdates}
              onChange={setCandidateUpdates}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default NotificationSettings;
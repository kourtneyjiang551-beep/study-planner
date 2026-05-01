'use client';

import TaskCard from './TaskCard';
import type { Task, Subject, TaskRecord } from '@/types';

interface TaskListProps {
  tasks: Task[];
  subjects: Subject[];
  records: TaskRecord[];
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
}

export default function TaskList({ tasks, subjects, records, onEditTask, onDeleteTask }: TaskListProps) {
  // 按科目分组
  const subjectMap = new Map(subjects.map(s => [s.id, s]));
  const recordMap = new Map(records.map(r => [r.task_id, r]));

  // 分组: subject_id -> tasks[]
  const groups = new Map<string, Task[]>();
  const noSubjectTasks: Task[] = [];

  for (const task of tasks) {
    if (task.subject_id && subjectMap.has(task.subject_id)) {
      const list = groups.get(task.subject_id) ?? [];
      list.push(task);
      groups.set(task.subject_id, list);
    } else {
      noSubjectTasks.push(task);
    }
  }

  // 按 subject sort_order 排序
  const sortedSubjectIds = [...groups.keys()].sort((a, b) => {
    const sa = subjectMap.get(a);
    const sb = subjectMap.get(b);
    return (sa?.sort_order ?? 0) - (sb?.sort_order ?? 0);
  });

  return (
    <div className="space-y-4">
      {sortedSubjectIds.map(subjectId => {
        const subject = subjectMap.get(subjectId)!;
        const groupTasks = groups.get(subjectId) ?? [];
        return (
          <div key={subjectId}>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: subject.color }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {subject.icon} {subject.name}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                ({groupTasks.length})
              </span>
            </div>
            <div className="space-y-2">
              {groupTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  subject={subject}
                  record={recordMap.get(task.id)}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* 无科目任务 */}
      {noSubjectTasks.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'var(--accent-3)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              📋 其他任务
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              ({noSubjectTasks.length})
            </span>
          </div>
          <div className="space-y-2">
            {noSubjectTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                record={recordMap.get(task.id)}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

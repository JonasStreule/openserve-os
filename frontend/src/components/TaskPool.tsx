import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useWebSocket } from '../services/useWebSocket';
import { ConfirmModal } from './ConfirmModal';
import { showToast } from './Toast';

interface Task {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: string;
  points: number;
  status: string;
  assigned_to?: string;
  assigned_username?: string;
  claimed_by?: string;
  claimed_username?: string;
  completed_by?: string;
  completed_username?: string;
  claimed_at?: string;
  completed_at?: string;
  created_at: string;
  due_by?: string;
}

interface TaskStats {
  open: number;
  in_progress: number;
  my_points_today: number;
}

type TaskTab = 'pool' | 'mine' | 'done';

const CATEGORIES: Record<string, { label: string; color: string }> = {
  cleaning: { label: 'Reinigung', color: '#3b82f6' },
  restock: { label: 'Auffüllen', color: '#f59e0b' },
  setup: { label: 'Setup', color: '#8b5cf6' },
  custom: { label: 'Sonstiges', color: '#6b7280' },
};

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Dringend' },
  { value: 'high', label: 'Hoch' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Niedrig' },
];

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function PriorityDot({ priority }: { priority: string }) {
  if (priority === 'low') return null;
  const color = priority === 'urgent' ? '#ef4444' : priority === 'high' ? '#f97316' : '#9ca3af';
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        marginRight: 6,
        animation: priority === 'urgent' ? 'taskPulse 1s ease-in-out infinite' : undefined,
      }}
    />
  );
}

function CategoryBadge({ category }: { category: string }) {
  const cat = CATEGORIES[category] || CATEGORIES.custom;
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 10,
        background: cat.color + '22',
        color: cat.color,
      }}
    >
      {cat.label}
    </span>
  );
}

function PointsBadge({ points }: { points: number }) {
  if (!points) return null;
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 10,
        background: '#fef3c7',
        color: '#92400e',
      }}
    >
      {'⭐'} {points}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs} Std.`;
  return `vor ${Math.floor(hrs / 24)} T.`;
}

export function TaskPool() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const userId = user?.id;
  const isAdmin = user?.role === 'admin';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats>({ open: 0, in_progress: 0, my_points_today: 0 });
  const [activeTab, setActiveTab] = useState<TaskTab>('pool');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('cleaning');
  const [newPriority, setNewPriority] = useState('normal');
  const [newPoints, setNewPoints] = useState('1');
  const [newDescription, setNewDescription] = useState('');

  const { lastMessage, connected } = useWebSocket('service');

  // Responsive check
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api.getTasks('status=open,claimed,done');
      setTasks(data.tasks || data || []);
    } catch {
      showToast('Aufgaben konnten nicht geladen werden', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getTaskStats();
      const username = user?.username;
      const myEntry = (data.points_today_by_user || []).find((e: any) => e.username === username);
      setStats({
        open: Number(data.open_count) || 0,
        in_progress: Number(data.claimed_count) || 0,
        my_points_today: myEntry ? Number(myEntry.points_today) : 0,
      });
    } catch {
      // stats are non-critical
    }
  }, [user?.username]);

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, [fetchTasks, fetchStats]);

  useEffect(() => {
    if (lastMessage && lastMessage.event?.startsWith('task:')) {
      fetchTasks();
      fetchStats();
    }
  }, [lastMessage, fetchTasks, fetchStats]);

  // Fallback polling when WS is disconnected
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(() => { fetchTasks(); fetchStats(); }, 10000);
    return () => clearInterval(interval);
  }, [connected, fetchTasks, fetchStats]);

  // Task groups
  const poolTasks = tasks.filter(t => t.status === 'open' && !t.claimed_by);
  const assignedToMe = tasks.filter(t => t.assigned_to === userId && t.status === 'open' && !t.claimed_by);
  const myTasks = tasks.filter(t => t.claimed_by === userId && t.status !== 'done');
  const doneTasks = tasks.filter(t => t.status === 'done');

  // Combined "Offen" column: unassigned pool + assigned to me
  const openTasks = [...poolTasks.filter(t => t.assigned_to !== userId), ...assignedToMe].sort((a, b) => {
    const prio: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    return (prio[a.priority] ?? 2) - (prio[b.priority] ?? 2);
  });

  const handleClaim = async (taskId: string) => {
    try {
      await api.claimTask(taskId);
      showToast('Aufgabe übernommen', 'success');
      fetchTasks();
      fetchStats();
    } catch {
      showToast('Fehler beim Übernehmen', 'error');
    }
  };

  const handleUnclaim = async (taskId: string) => {
    try {
      await api.unclaimTask(taskId);
      showToast('Aufgabe zurückgegeben', 'info');
      fetchTasks();
      fetchStats();
    } catch {
      showToast('Fehler beim Zurückgeben', 'error');
    }
  };

  const handleComplete = (taskId: string, title: string) => {
    setConfirmAction({
      title: 'Aufgabe abschliessen',
      message: `"${title}" als erledigt markieren?`,
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await api.completeTask(taskId);
          showToast('Aufgabe erledigt!', 'success');
          fetchTasks();
          fetchStats();
        } catch {
          showToast('Fehler beim Abschliessen', 'error');
        }
      },
    });
  };

  const handleDelete = (taskId: string, title: string) => {
    setConfirmAction({
      title: 'Aufgabe löschen',
      message: `"${title}" wirklich löschen? Dies kann nicht rückgängig gemacht werden.`,
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await api.deleteTask(taskId);
          showToast('Aufgabe gelöscht', 'info');
          fetchTasks();
          fetchStats();
        } catch {
          showToast('Fehler beim Löschen', 'error');
        }
      },
    });
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      showToast('Titel eingeben', 'error');
      return;
    }
    try {
      await api.createTask({
        title: newTitle.trim(),
        category: newCategory,
        priority: newPriority,
        points: parseInt(newPoints) || 1,
        description: newDescription.trim() || undefined,
      });
      showToast('Aufgabe erstellt', 'success');
      setNewTitle('');
      setNewDescription('');
      setNewCategory('cleaning');
      setNewPriority('normal');
      setNewPoints('1');
      setShowCreateForm(false);
      fetchTasks();
      fetchStats();
    } catch {
      showToast('Fehler beim Erstellen', 'error');
    }
  };

  // Styles
  const tabStyle = (active: boolean) => ({
    flex: 1,
    padding: '10px',
    border: 'none',
    borderBottom: active ? '2px solid var(--color-black)' : '2px solid transparent',
    background: 'transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-secondary)',
    fontFamily: 'var(--font-system)',
    fontSize: '14px',
    fontWeight: (active ? '600' : '400') as '600' | '400',
    cursor: 'pointer',
  });

  const columnHeaderStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--color-secondary)',
    marginBottom: 8,
    padding: '0 4px',
  };

  const renderTaskCard = (task: Task, section: 'pool' | 'mine' | 'done') => {
    const isAssignedToMe = task.assigned_to === userId;

    return (
      <div key={task.id} className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <PriorityDot priority={task.priority} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>{task.title}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <CategoryBadge category={task.category} />
            <PointsBadge points={task.points} />
          </div>
        </div>

        {task.description && (
          <p style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--color-secondary)', lineHeight: 1.4 }}>
            {task.description}
          </p>
        )}

        {/* Meta info */}
        <div style={{ fontSize: 11, color: 'var(--color-secondary)', marginBottom: 8 }}>
          {section === 'pool' && isAssignedToMe && (
            <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Dir zugewiesen</span>
          )}
          {section === 'pool' && task.claimed_username && (
            <span>{task.claimed_username} - {task.claimed_at ? timeAgo(task.claimed_at) : ''}</span>
          )}
          {section === 'mine' && task.claimed_at && (
            <span>Übernommen {timeAgo(task.claimed_at)}</span>
          )}
          {section === 'done' && (
            <span>
              {task.completed_username && `${task.completed_username} - `}
              {task.completed_at ? timeAgo(task.completed_at) : ''}
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {section === 'pool' && (
            <button
              className="button primary"
              style={{ fontSize: 13, height: 34, flex: 1 }}
              onClick={() => handleClaim(task.id)}
            >
              {isAssignedToMe ? 'Starten' : 'Übernehmen'}
            </button>
          )}
          {section === 'mine' && (
            <>
              <button
                className="button primary"
                style={{ fontSize: 13, height: 34, flex: 1, background: 'var(--color-success, #10b981)' }}
                onClick={() => handleComplete(task.id, task.title)}
              >
                Erledigt {'✓'}
              </button>
              <button
                className="button secondary"
                style={{ fontSize: 13, height: 34 }}
                onClick={() => handleUnclaim(task.id)}
              >
                Zurück
              </button>
            </>
          )}
          {section === 'done' && isAdmin && (
            <button
              className="button secondary"
              style={{ fontSize: 12, height: 30, color: 'var(--color-error)' }}
              onClick={() => handleDelete(task.id, task.title)}
            >
              Löschen
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderColumn = (title: string, count: number, items: Task[], section: 'pool' | 'mine' | 'done') => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={columnHeaderStyle}>
        {title} ({count})
      </div>
      {items.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--color-secondary)', fontSize: 13, marginTop: 24 }}>
          {section === 'pool' ? 'Keine offenen Aufgaben' : section === 'mine' ? 'Keine aktiven Aufgaben' : 'Heute noch nichts erledigt'}
        </p>
      )}
      {items.map(task => renderTaskCard(task, section))}
    </div>
  );

  return (
    <div style={{ padding: '16px', maxWidth: isMobile ? '100%' : '1200px', margin: '0 auto' }}>
      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes taskPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>{'📋'} Aufgaben</h1>
          <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 2 }}>
            {stats.open} offen, {stats.in_progress} in Arbeit
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Points today */}
          <div style={{
            background: '#fef3c7',
            color: '#92400e',
            fontWeight: 700,
            fontSize: 14,
            padding: '6px 12px',
            borderRadius: 12,
          }}>
            {'⭐'} {stats.my_points_today || 0} Punkte
          </div>
          <span style={{ fontSize: 12, color: connected ? 'var(--color-success)' : 'var(--color-error)' }}>
            {connected ? 'Live' : 'Offline'}
          </span>
          <button
            className="button secondary"
            style={{ fontSize: 12, height: 32 }}
            onClick={() => navigate(-1)}
          >
            Zurück
          </button>
        </div>
      </div>

      {/* Admin: Create task button */}
      {isAdmin && (
        <div style={{ marginBottom: 12 }}>
          <button
            className="button primary"
            style={{ fontSize: 13, height: 36 }}
            onClick={() => setShowCreateForm(true)}
          >
            + Neue Aufgabe
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <p style={{ textAlign: 'center', color: 'var(--color-secondary)', marginTop: 40 }}>Lade Aufgaben...</p>
      )}

      {/* Mobile: Tabs */}
      {!loading && isMobile && (
        <>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-gray-200)', marginBottom: 12 }}>
            <button style={tabStyle(activeTab === 'pool')} onClick={() => setActiveTab('pool')}>
              Offen ({openTasks.length})
            </button>
            <button style={tabStyle(activeTab === 'mine')} onClick={() => setActiveTab('mine')}>
              Meine ({myTasks.length})
            </button>
            <button style={tabStyle(activeTab === 'done')} onClick={() => setActiveTab('done')}>
              Erledigt ({doneTasks.length})
            </button>
          </div>
          {activeTab === 'pool' && renderColumn('Offen', openTasks.length, openTasks, 'pool')}
          {activeTab === 'mine' && renderColumn('Meine', myTasks.length, myTasks, 'mine')}
          {activeTab === 'done' && renderColumn('Erledigt', doneTasks.length, doneTasks, 'done')}
        </>
      )}

      {/* Desktop: Three columns */}
      {!loading && !isMobile && (
        <div style={{ display: 'flex', gap: 16 }}>
          {renderColumn('Offen', openTasks.length, openTasks, 'pool')}
          {renderColumn('Meine', myTasks.length, myTasks, 'mine')}
          {renderColumn('Erledigt', doneTasks.length, doneTasks, 'done')}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateForm && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          }}
          onClick={() => setShowCreateForm(false)}
        >
          <div
            className="card"
            style={{ width: '380px', maxWidth: '95vw', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: 18 }}>Neue Aufgabe</h2>

            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-secondary)', display: 'block', marginBottom: 4 }}>
                  Titel *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="z.B. Bar auffüllen"
                  style={{
                    width: '100%', padding: '8px 10px', fontSize: 14,
                    border: '1px solid var(--color-gray-200)', borderRadius: 8,
                    fontFamily: 'var(--font-system)', boxSizing: 'border-box',
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-secondary)', display: 'block', marginBottom: 4 }}>
                  Beschreibung
                </label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Optional"
                  rows={2}
                  style={{
                    width: '100%', padding: '8px 10px', fontSize: 14,
                    border: '1px solid var(--color-gray-200)', borderRadius: 8,
                    fontFamily: 'var(--font-system)', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-secondary)', display: 'block', marginBottom: 4 }}>
                    Kategorie
                  </label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', fontSize: 14,
                      border: '1px solid var(--color-gray-200)', borderRadius: 8,
                      fontFamily: 'var(--font-system)', background: 'var(--color-white, #fff)',
                    }}
                  >
                    {Object.entries(CATEGORIES).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-secondary)', display: 'block', marginBottom: 4 }}>
                    Priorität
                  </label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', fontSize: 14,
                      border: '1px solid var(--color-gray-200)', borderRadius: 8,
                      fontFamily: 'var(--font-system)', background: 'var(--color-white, #fff)',
                    }}
                  >
                    {PRIORITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-secondary)', display: 'block', marginBottom: 4 }}>
                  Punkte
                </label>
                <input
                  type="number"
                  value={newPoints}
                  onChange={e => setNewPoints(e.target.value)}
                  min="0"
                  max="20"
                  style={{
                    width: '80px', padding: '8px 10px', fontSize: 14,
                    border: '1px solid var(--color-gray-200)', borderRadius: 8,
                    fontFamily: 'var(--font-system)',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                className="button secondary"
                onClick={() => setShowCreateForm(false)}
                style={{ flex: 1, height: 44, fontSize: 15 }}
              >
                Abbrechen
              </button>
              <button
                className="button primary"
                onClick={handleCreate}
                style={{ flex: 1, height: 44, fontSize: 15 }}
              >
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel="Bestätigen"
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

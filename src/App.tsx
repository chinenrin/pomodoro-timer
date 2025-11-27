import React, { useEffect, useState } from "react";

// ===== 型定義 =====
type Mode = "focus" | "break";

type Task = {
  id: string;
  title: string;
  category: string;
  estimate: number; // 予想ポモドーロ数
  done: boolean;
  completedPomodoros: number;
};

type Session = {
  id: string;
  taskId: string | null;
  start: string; // ISO文字列
  end: string;
  durationSec: number;
  type: Mode;
};

// ===== localStorageと同期するカスタムフック =====

function useLocalStorageState<T>(
  key: string,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : defaultValue;
    } catch (e) {
      console.error("Failed to parse localStorage", e);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Failed to save to localStorage", e);
    }
  }, [key, value]);

  return [value, setValue];
}

// ===== ボタンスタイル定義 =====
const timerPrimaryButtonStyle: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: "999px",
  border: "none",
  cursor: "pointer",
  fontSize: "0.95rem",
  fontWeight: 600,
  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
  backgroundColor: "#61dafb",
  color: "#000",
  transition: "transform 0.1s ease, box-shadow 0.1s ease, background-color 0.2s ease",
};

const timerSecondaryButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.5)",
  cursor: "pointer",
  fontSize: "0.9rem",
  backgroundColor: "transparent",
  color: "inherit",
  transition: "transform 0.1s ease, box-shadow 0.1s ease, background-color 0.2s ease, border-color 0.2s ease",
};

const taskPrimaryButtonStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: "999px",
  border: "none",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 600,
  backgroundColor: "#61dafb",
  color: "#000",
  boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
  transition: "background-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease",
};

const taskButtonStyle: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: "999px",
  border: "1px solid #ccc",
  cursor: "pointer",
  fontSize: "0.8rem",
  backgroundColor: "#f8f9fa",
  color: "#333",
  transition: "background-color 0.2s ease, border-color 0.2s ease, transform 0.1s ease",
};

const App: React.FC = () => {
  // ==== タスク関連 ====
  const [tasks, setTasks] = useLocalStorageState<Task[]>("tasks", []);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCategory, setTaskCategory] = useState("");
  const [taskEstimate, setTaskEstimate] = useState<number>(1);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // ==== セッションログ ====
  const [sessions, setSessions] = useLocalStorageState<Session[]>(
    "sessions",
    []
  );

  // ==== タイマー関連 ====
  const FOCUS_MIN = 1;
  const BREAK_MIN = 1;

  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState<number>(FOCUS_MIN * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentSessionStart, setCurrentSessionStart] = useState<string | null>(
    null
  );

  // 秒数から mm:ss に整形
  const formatTime = (sec: number): string => {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  // セッション終了時の処理
  const handleSessionEnd = () => {
    setIsRunning(false);

    if (!currentSessionStart) {
      // 手動で0にしたなど、開始時刻が無いときは何もしないでモードだけ切り替え
      setMode((prev) => (prev === "focus" ? "break" : "focus"));
      return;
    }

    const end = new Date().toISOString();
    const startDate = new Date(currentSessionStart);
    const endDate = new Date(end);
    const durationSec = Math.round((endDate.getTime() - startDate.getTime()) / 1000);

    const newSession: Session = {
      id: Date.now().toString(),
      taskId: mode === "focus" ? selectedTaskId : null,
      start: currentSessionStart,
      end,
      durationSec,
      type: mode,
    };

    setSessions((prev) => [...prev, newSession]);

    // 集中が終わったらタスクに1ポモドーロ追加
    if (mode === "focus" && selectedTaskId) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTaskId
            ? { ...t, completedPomodoros: t.completedPomodoros + 1 }
            : t
        )
      );
      setMode("break");
    } else {
      setMode("focus");
    }

    setCurrentSessionStart(null);
  };

  // タイマーのカウントダウン
  useEffect(() => {
    if (!isRunning) return;

    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          handleSessionEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, [isRunning]); // eslintの警告が出たら handleSessionEnd を useCallback にして依存に足してもOK

  // モードが変わったら残り時間をリセット
  useEffect(() => {
    if (mode === "focus") {
      setSecondsLeft(FOCUS_MIN * 60);
    } else {
      setSecondsLeft(BREAK_MIN * 60);
    }
  }, [mode]);

  // ==== タスク追加 ====
  const handleAddTask: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      title: taskTitle.trim(),
      category: taskCategory.trim(),
      estimate: Number(taskEstimate) || 0,
      done: false,
      completedPomodoros: 0,
    };

    setTasks((prev) => [...prev, newTask]);
    setTaskTitle("");
    setTaskCategory("");
    setTaskEstimate(1);

    if (!selectedTaskId) {
      setSelectedTaskId(newTask.id);
    }
  };

  // タスク完了トグル
  const toggleTaskDone = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, done: !t.done } : t
      )
    );
  };

  // ==== タイマー操作 ====
  const handleStart = () => {
    if (mode === "focus" && !selectedTaskId) {
      alert("集中モードでは、先にタスクを選んでください。");
      return;
    }
    if (!isRunning) {
      setIsRunning(true);
      setCurrentSessionStart(new Date().toISOString());
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentSessionStart(null);
    if (mode === "focus") {
      setSecondsLeft(FOCUS_MIN * 60);
    } else {
      setSecondsLeft(BREAK_MIN * 60);
    }
  };

  const handleSwitchMode = () => {
    setIsRunning(false);
    setCurrentSessionStart(null);
    setMode((prev) => (prev === "focus" ? "break" : "focus"));
  };

  // ==== 日別集計 ====
  const focusSessions = sessions.filter((s) => s.type === "focus");
  const dailyStats: Record<string, number> = focusSessions.reduce(
    (acc, s) => {
      const d = new Date(s.start);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      if (!acc[key]) acc[key] = 0;
      acc[key] += s.durationSec;
      return acc;
    },
    {} as Record<string, number>
  );

  const maxSec =
    Object.values(dailyStats).length > 0
      ? Math.max(...Object.values(dailyStats))
      : 0;

  const daysSorted = Object.keys(dailyStats).sort();

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        minHeight: "100vh",
        // 状態に応じて背景色を切り替え（動作中はReactブルー）
        background: "#242424",
        backgroundSize: "400% 400%",
        animation: isRunning ? "bgMove 8s ease infinite" : "none",
        color: isRunning ? "#61dafb" : "#fff",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "32px",
        transition: "background 1s ease, color 0.8s ease",
      }}
    >
      {/* 背景アニメーションの定義 */}
      <style>
        {`
          @keyframes bgMove {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}
      </style>

      {/* ===== 画面中央の大きいタイマー ===== */}
      <section style={{ textAlign: "center" }}>
        <h2>⏱ ポモドーロタイマー</h2>
        <div
          style={{
            position: "relative",
            width: "220px",
            height: "220px",
            margin: "20px auto",
          }}
        >
          <svg width="220" height="220">
            <circle
              cx="110"
              cy="110"
              r="100"
              stroke="#ccc"
              strokeWidth="10"
              fill="none"
            />
            <circle
              cx="110"
              cy="110"
              r="100"
              stroke="#61dafb"
              strokeWidth="10"
              fill="none"
              strokeDasharray={2 * Math.PI * 100}
              strokeDashoffset={
                2 * Math.PI * 100 * (1 - secondsLeft / (mode === "focus" ? FOCUS_MIN * 60 : BREAK_MIN * 60))
              }
              strokeLinecap="round"
              transform="rotate(-90 110 110)"
              style={{
                transition: "stroke-dashoffset 1s linear",
              }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: "3rem",
              fontWeight: "bold",
              color: "#fff",
            }}
          >
            {formatTime(secondsLeft)}
          </div>
        </div>
        <p style={{ fontSize: "1.2rem", marginBottom: "12px" }}>
          現在モード：<strong>{mode === "focus" ? "集中" : "休憩"}</strong>
        </p>
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
          }}
        >
          <button
            onClick={handleStart}
            style={timerPrimaryButtonStyle}
          >
            {isRunning ? "再スタート" : "スタート"}
          </button>
          <button
            onClick={handlePause}
            style={timerSecondaryButtonStyle}
          >
            一時停止
          </button>
          <button
            onClick={handleReset}
            style={timerSecondaryButtonStyle}
          >
            リセット
          </button>
          <button
            onClick={handleSwitchMode}
            style={timerSecondaryButtonStyle}
          >
            モード切替
          </button>
        </div>
      </section>

      {/* ===== 下部エリア：左にタスク、右にグラフ＋ログ ===== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          width: "100%",
          maxWidth: "1000px",
        }}
      >
        {/* タスク管理 */}
        <section
          style={{
            backgroundColor: "white",
            color: "black",
            borderRadius: "8px",
            padding: "12px",
          }}
        >
          <h2>📋 今やるタスク</h2>
          <form
            onSubmit={handleAddTask}
            style={{ display: "grid", gap: "8px", marginBottom: "8px" }}
          >
            <input
              type="text"
              placeholder="タスク名（例：論文読み、実験条件整理）"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <input
              type="text"
              placeholder="カテゴリ（例：実験 / 解析 / 読書）"
              value={taskCategory}
              onChange={(e) => setTaskCategory(e.target.value)}
            />
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <label style={{ fontSize: "0.9rem" }}>
                予想ポモドーロ数：
              </label>
              <input
                type="number"
                min={1}
                value={taskEstimate}
                onChange={(e) => setTaskEstimate(Number(e.target.value))}
                style={{ width: "80px" }}
              />
              <button type="submit" style={taskPrimaryButtonStyle}>
                追加
              </button>
            </div>
          </form>

          {tasks.length === 0 ? (
            <p style={{ fontSize: "0.9rem", color: "#666" }}>
              まだタスクがありません。上のフォームから追加してね。
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {tasks.map((t) => (
                <li
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 4px",
                    borderBottom: "1px solid #eee",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      textDecoration: t.done ? "line-through" : "none",
                      opacity: t.done ? 0.6 : 1,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    <div style={{ fontSize: "0.8rem", color: "#555" }}>
                      {t.category && <>カテゴリ: {t.category} / </>}
                      予想: {t.estimate} ポモドーロ /
                      実績: {t.completedPomodoros}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTaskId(t.id)}
                    style={{
                      ...taskButtonStyle,
                      border:
                        selectedTaskId === t.id
                          ? "2px solid #007bff"
                          : "1px solid #ccc",
                      background:
                        selectedTaskId === t.id ? "#e6f0ff" : "#f8f9fa",
                    }}
                  >
                    {selectedTaskId === t.id ? "選択中" : "選択"}
                  </button>
                  <button
                    onClick={() => toggleTaskDone(t.id)}
                    style={taskButtonStyle}
                  >
                    {t.done ? "未完了に戻す" : "完了"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 右側：グラフ + セッションログ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* 可視化 */}
          <section
            style={{
              backgroundColor: "white",
              color: "black",
              borderRadius: "8px",
              padding: "12px",
            }}
          >
            <h2>📈 日別集中時間</h2>
            {daysSorted.length === 0 ? (
              <p style={{ fontSize: "0.9rem", color: "#666" }}>
                まだ集中セッションの記録がありません。タイマーを回してみよう。
              </p>
            ) : (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "8px",
                    height: "150px",
                    borderBottom: "1px solid #ccc",
                    paddingBottom: "8px",
                    marginBottom: "8px",
                  }}
                >
                  {daysSorted.map((day) => {
                    const sec = dailyStats[day];
                    const ratio = maxSec ? sec / maxSec : 0;
                    const height = 20 + ratio * 100;
                    const min = Math.round(sec / 60);
                    return (
                      <div
                        key={day}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            width: "20px",
                            height: `${height}px`,
                            borderRadius: "4px 4px 0 0",
                            border: "1px solid #007bff",
                            background:
                              "linear-gradient(to top, #cfe2ff, #f5f9ff)",
                          }}
                          title={`${day}: ${min}分`}
                        />
                        <div
                          style={{ fontSize: "0.7rem", marginTop: "4px" }}
                        >
                          {min}分
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.7rem",
                    color: "#555",
                  }}
                >
                  {daysSorted.map((day) => (
                    <span
                      key={day}
                      style={{ flex: 1, textAlign: "center" }}
                    >
                      {day.slice(5)} {/* MM-DD */}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* セッションログ */}
          <section
            style={{
              backgroundColor: "white",
              color: "black",
              borderRadius: "8px",
              padding: "12px",
              maxHeight: "220px",
              overflow: "auto",
            }}
          >
            <h2>🧾 セッションログ</h2>
            {sessions.length === 0 ? (
              <p style={{ fontSize: "0.9rem", color: "#666" }}>
                まだログはありません。
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {sessions
                  .slice()
                  .reverse()
                  .map((s) => {
                    const d = new Date(s.start);
                    const labelDate = d.toLocaleString();
                    const min = Math.round(s.durationSec / 60);
                    const task =
                      s.taskId && tasks.find((t) => t.id === s.taskId);
                    return (
                      <li
                        key={s.id}
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: "4px 0",
                          fontSize: "0.8rem",
                        }}
                      >
                        <div>
                          [{s.type === "focus" ? "集中" : "休憩"}] {labelDate}
                        </div>
                        <div>
                          時間: {min} 分
                          {task && <> / タスク: {task.title}</>}
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default App;
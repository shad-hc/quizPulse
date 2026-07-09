import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import QuizListPage from './pages/QuizListPage';
import CreateQuizPage from './pages/CreateQuizPage';
import QuizRoomPage from './pages/QuizRoomPage';
import ResultsPage from './pages/ResultsPage';

type Page = 'home' | 'login' | 'create' | 'room' | 'results';

interface NavParams { quizId?: string }

function AppRoutes() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<Page>('home');
  const [params, setParams] = useState<NavParams>({});

  const navigate = (p: string, newParams?: Record<string, string>) => {
    setPage(p as Page);
    if (newParams) setParams(newParams);
  };

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        background:'#0f0f1a', color:'#a78bfa', fontSize:24, fontWeight:800 }}>
        ⚡ QuizPulse
      </div>
    );
  }

  if (!user) return <LoginPage onNavigate={navigate} />;

  switch (page) {
    case 'create': return <CreateQuizPage onNavigate={navigate} />;
    case 'room':   return params.quizId
      ? <QuizRoomPage quizId={params.quizId} onNavigate={navigate} />
      : <QuizListPage onNavigate={navigate} />;
    case 'results': return params.quizId
      ? <ResultsPage quizId={params.quizId} onNavigate={navigate} />
      : <QuizListPage onNavigate={navigate} />;
    default: return <QuizListPage onNavigate={navigate} />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

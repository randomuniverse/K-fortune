import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Eye, EyeOff, Users, Calendar, Clock, MapPin, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface AdminUser {
  id: number;
  name: string;
  telegramId: string;
  telegramHandle: string | null;
  telegramChatId: string | null;
  birthDate: string;
  birthTime: string;
  gender: string;
  mbti: string | null;
  birthCountry: string | null;
  birthCity: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
  dayMaster: string;
  fiveElementBalance: { element: string; elementHanja: string; ratio: number }[];
  zodiacSign: string;
}

export default function Admin() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const savedToken = sessionStorage.getItem("admin_token");
    if (savedToken) {
      setSessionToken(savedToken);
      setAuthenticated(true);
      fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: savedToken }),
      }).then(res => res.ok ? res.json() : Promise.reject()).then(data => setUsers(data)).catch(() => {
        sessionStorage.removeItem("admin_token");
        setAuthenticated(false);
      });
    }
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        toast({ title: "인증 실패", description: "비밀번호가 올바르지 않습니다.", variant: "destructive" });
        setLoading(false);
        return;
      }
      const data = await res.json();
      setSessionToken(data.token);
      sessionStorage.setItem("admin_token", data.token);
      setAuthenticated(true);
      await fetchUsers(data.token);
    } catch {
      toast({ title: "오류", description: "서버 연결에 실패했습니다.", variant: "destructive" });
    }
    setLoading(false);
  };

  const fetchUsers = async (tk: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tk }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      toast({ title: "오류", description: "사용자 목록을 불러올 수 없습니다.", variant: "destructive" });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const getGenderLabel = (g: string) => {
    if (g === "male" || g === "남") return "남";
    if (g === "female" || g === "여") return "여";
    return g;
  };

  const getElementColor = (element: string) => {
    const colors: Record<string, string> = {
      "목(木)": "text-green-400",
      "화(火)": "text-red-400",
      "토(土)": "text-yellow-400",
      "금(金)": "text-gray-300",
      "수(水)": "text-blue-400",
    };
    return colors[element] || "text-gray-400";
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0015] via-[#1a0030] to-[#0a0015] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="bg-[#1a1035]/80 border-purple-900/30 backdrop-blur-xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-purple-900/40 flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-purple-400" />
              </div>
              <CardTitle className="text-2xl font-bold text-purple-100" style={{ fontFamily: "Cinzel" }}>
                관리자 인증
              </CardTitle>
              <p className="text-purple-400/70 text-sm mt-2">천상의 운세 관리자 페이지</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Input
                  data-testid="input-admin-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="관리자 비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="bg-[#0d0020] border-purple-800/40 text-purple-100 pr-10"
                />
                <button
                  data-testid="button-toggle-password"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-500 hover:text-purple-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button
                data-testid="button-admin-login"
                onClick={handleLogin}
                disabled={loading || !password}
                className="w-full bg-purple-700 hover:bg-purple-600 text-white"
              >
                {loading ? "인증 중..." : "접속"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0015] via-[#1a0030] to-[#0a0015] px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-purple-400 hover:text-purple-300" data-testid="link-admin-home">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-purple-100" style={{ fontFamily: "Cinzel" }}>
                관리자 대시보드
              </h1>
              <p className="text-purple-400/70 text-sm flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                등록 사용자 {users.length}명
              </p>
            </div>
          </div>
          <Button
            data-testid="button-refresh-users"
            variant="outline"
            size="sm"
            onClick={() => fetchUsers(sessionToken)}
            className="border-purple-800/40 text-purple-300 hover:bg-purple-900/30"
          >
            새로고침
          </Button>
        </div>

        <AnimatePresence>
          <div className="grid gap-4">
            {users.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="bg-[#1a1035]/60 border-purple-900/20 hover:border-purple-700/40 transition-colors" data-testid={`card-user-${user.id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <div>
                          <p className="text-[10px] text-purple-500 uppercase tracking-wider">이름</p>
                          <p className="text-purple-100 font-medium" data-testid={`text-name-${user.id}`}>{user.name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-purple-500 uppercase tracking-wider">텔레그램</p>
                          <p className="text-purple-200 text-sm" data-testid={`text-telegram-${user.id}`}>
                            @{user.telegramHandle || user.telegramId}
                          </p>
                          {user.telegramChatId && (
                            <p className="text-green-400/60 text-[10px]">연동됨</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-purple-500 uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> 생년월일
                          </p>
                          <p className="text-purple-200 text-sm">{user.birthDate}</p>
                          <p className="text-purple-400/60 text-[10px]">{user.birthTime} · {getGenderLabel(user.gender)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-purple-500 uppercase tracking-wider">일간 / 별자리</p>
                          <p className="text-purple-100 text-sm">
                            <span className="text-amber-400 font-bold">{user.dayMaster}</span>
                            {" · "}
                            <span className="text-purple-300">{user.zodiacSign}</span>
                          </p>
                          {user.mbti && (
                            <p className="text-purple-400/60 text-[10px]">MBTI: {user.mbti}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-purple-500 uppercase tracking-wider">오행</p>
                          <div className="flex gap-1 flex-wrap">
                            {(user.fiveElementBalance || []).map((el) => (
                              <span key={el.element} className={`text-[10px] ${getElementColor(el.element)}`}>
                                {el.element.replace(/[()]/g, "")}{el.ratio}%
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-purple-500 uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-3 h-3" /> 접속
                          </p>
                          <p className="text-purple-300/80 text-[11px]" data-testid={`text-lastlogin-${user.id}`}>
                            {user.lastLoginAt ? formatDate(user.lastLoginAt) : "기록 없음"}
                          </p>
                          <p className="text-purple-500/50 text-[10px]">
                            가입: {formatDate(user.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 md:flex-col">
                        <Link href={`/dashboard/${user.telegramHandle || user.telegramId}?from=admin`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-purple-400 hover:text-purple-200 text-xs"
                            data-testid={`button-view-dashboard-${user.id}`}
                          >
                            대시보드 보기
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>

        {users.length === 0 && (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-purple-800 mx-auto mb-3" />
            <p className="text-purple-500">등록된 사용자가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}

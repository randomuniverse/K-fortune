import { useRoute, useLocation } from "wouter";
import { useUser, useUpdateUser } from "@/hooks/use-fortune";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, ArrowLeft, CheckCircle, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect } from "react";
import { getZodiacSign } from "@shared/schema";

const MBTI_TYPES = [
  "ISTJ", "ISFJ", "INFJ", "INTJ",
  "ISTP", "ISFP", "INFP", "INTP",
  "ESTP", "ESFP", "ENFP", "ENTP",
  "ESTJ", "ESFJ", "ENFJ", "ENTJ",
];

interface SettingsFormData {
  name: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  mbti: string;
  birthCountry: string;
  birthCity: string;
  preferredDeliveryTime: string;
}

export default function Settings() {
  const [match, params] = useRoute("/settings/:telegramId");
  const [, setLocation] = useLocation();
  const telegramId = params?.telegramId || "";
  const { data: user, isLoading } = useUser(telegramId);
  const updateUser = useUpdateUser();
  const { toast } = useToast();

  const form = useForm<SettingsFormData>({
    defaultValues: {
      name: "",
      birthDate: "",
      birthTime: "",
      gender: "male",
      mbti: "",
      birthCountry: "",
      birthCity: "",
      preferredDeliveryTime: "07:00",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        birthDate: user.birthDate,
        birthTime: user.birthTime,
        gender: user.gender,
        mbti: user.mbti || "",
        birthCountry: user.birthCountry || "",
        birthCity: user.birthCity || "",
        preferredDeliveryTime: user.preferredDeliveryTime || "07:00",
      });
    }
  }, [user, form]);

  const onSubmit = (data: SettingsFormData) => {
    updateUser.mutate(
      {
        telegramId,
        data: {
          ...data,
          mbti: data.mbti || null,
          birthCountry: data.birthCountry || null,
          birthCity: data.birthCity || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "정보가 수정되었습니다", description: "변경사항이 저장되었습니다." });
        },
        onError: (error) => {
          toast({ variant: "destructive", title: "수정 실패", description: error.message });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground animate-pulse">정보를 불러오는 중...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-muted-foreground mb-4">사용자를 찾을 수 없습니다.</p>
          <Button variant="outline" onClick={() => setLocation("/")} data-testid="button-go-home">홈으로 돌아가기</Button>
        </div>
      </Layout>
    );
  }

  const zodiacSign = getZodiacSign(user.birthDate);
  const inputClass = "bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50";

  return (
    <Layout telegramId={telegramId}>
      <div className="flex flex-col items-center w-full max-w-lg mx-auto py-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full"
        >
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/dashboard/${telegramId}`)} data-testid="button-back">
              <ArrowLeft className="h-5 w-5 text-white" />
            </Button>
            <div>
              <h2 className="text-2xl font-serif text-white">설정</h2>
              <p className="text-sm text-muted-foreground">내 정보를 확인하고 수정할 수 있습니다</p>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl mb-6">
            <div className="flex items-center gap-4 pb-4 mb-4 border-b border-white/10">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary text-lg font-serif">
                {user.name.charAt(0)}
              </div>
              <div>
                <p className="text-white font-medium" data-testid="text-user-name">{user.name}</p>
                <p className="text-sm text-muted-foreground" data-testid="text-user-info">
                  {zodiacSign} {user.mbti ? `/ ${user.mbti}` : ""} / ID: {user.telegramId}
                </p>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-primary/90">이름</FormLabel>
                      <FormControl>
                        <Input {...field} className={inputClass} data-testid="input-settings-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-primary/90 text-sm font-medium mb-3">텔레그램 연동</p>
                  {user.telegramChatId ? (
                    <div className="flex items-center gap-2 text-green-400" data-testid="status-telegram-connected">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">연동 완료</span>
                      {user.telegramHandle && (
                        <span className="text-xs text-muted-foreground ml-1">@{user.telegramHandle}</span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2" data-testid="status-telegram-not-connected">
                      <p className="text-sm text-muted-foreground">텔레그램과 연동하면 매일 아침 운세를 자동으로 받을 수 있어요.</p>
                      {user.linkToken && (
                        <a
                          href={`https://t.me/ricky_lucky_guardian_bot?start=${user.linkToken}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="link-settings-telegram-deeplink"
                        >
                          <Button type="button" variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10 w-full mt-1">
                            <ExternalLink className="w-3.5 h-3.5 mr-2" />
                            텔레그램 연동하기
                          </Button>
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="birthDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-primary/90">생년월일</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className={inputClass} data-testid="input-settings-birth-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="birthTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-primary/90">태어난 시간</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} className={inputClass} data-testid="input-settings-birth-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-primary/90">성별</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={inputClass} data-testid="select-settings-gender">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-secondary border-primary/20 text-white">
                            <SelectItem value="male">남성</SelectItem>
                            <SelectItem value="female">여성</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mbti"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-primary/90">MBTI</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger className={inputClass} data-testid="select-settings-mbti">
                              <SelectValue placeholder="선택" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-secondary border-primary/20 text-white max-h-[200px]">
                            <SelectItem value="none">선택 안함</SelectItem>
                            {MBTI_TYPES.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="birthCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-primary/90">출생 국가</FormLabel>
                        <FormControl>
                          <Input placeholder="대한민국" {...field} className={inputClass} data-testid="input-settings-country" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="birthCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-primary/90">출생 도시</FormLabel>
                        <FormControl>
                          <Input placeholder="서울" {...field} className={inputClass} data-testid="input-settings-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="preferredDeliveryTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-primary/90">알림 희망 시간</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} className={inputClass} data-testid="input-settings-delivery" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  variant="mystical"
                  size="lg"
                  className="w-full mt-2"
                  disabled={updateUser.isPending}
                  data-testid="button-save-settings"
                >
                  {updateUser.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 저장 중...</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" /> 변경사항 저장</>
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { useCreateUser } from "@/hooks/use-fortune";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { z } from "zod";

const MBTI_TYPES = [
  "ISTJ", "ISFJ", "INFJ", "INTJ",
  "ISTP", "ISFP", "INFP", "INTP",
  "ESTP", "ESFP", "ENFP", "ENTP",
  "ESTJ", "ESFJ", "ENFJ", "ENTJ",
];

const registerSchema = insertUserSchema.extend({
  telegramHandle: z.string().optional(),
  telegramChatId: z.string().nullable().optional(),
  preferredDeliveryTime: z.string().default("07:00"),
  mbti: z.string().nullable().optional(),
  birthCountry: z.string().nullable().optional(),
  birthCity: z.string().nullable().optional(),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createUser = useCreateUser();

  const form = useForm<InsertUser>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      telegramId: "",
      telegramHandle: "",
      birthDate: "",
      birthTime: "",
      gender: "male",
      preferredDeliveryTime: "07:00",
      mbti: "",
      birthCountry: "",
      birthCity: "",
    },
  });

  const onSubmit = (data: InsertUser) => {
    const isNumericId = /^\d+$/.test(data.telegramId);
    const payload = {
      ...data,
      telegramChatId: isNumericId ? data.telegramId : null,
      mbti: data.mbti || null,
      birthCountry: data.birthCountry || null,
      birthCity: data.birthCity || null,
    };
    createUser.mutate(payload, {
      onSuccess: (user) => {
        toast({
          title: "운명이 연결되었습니다",
          description: `환영합니다, ${user.name}님. 당신의 사주 지도가 완성되었습니다.`,
        });
        setLocation(`/dashboard/${user.telegramId}`);
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "등록 오류",
          description: error.message,
        });
      },
    });
  };

  const inputClass = "bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50";

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-serif text-glow mb-2">여정 시작하기</h2>
            <p className="text-muted-foreground">
              태어난 정보를 입력하여 별들과 정렬하세요. 텔레그램 ID를 통해 매일 운세를 보내드립니다.
            </p>
          </div>

          <div className="glass-panel p-8 rounded-2xl">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-primary/90">이름</FormLabel>
                        <FormControl>
                          <Input placeholder="홍길동" {...field} className={inputClass} data-testid="input-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telegramHandle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-primary/90">텔레그램 핸들 (선택)</FormLabel>
                        <FormControl>
                          <Input placeholder="@username" {...field} value={field.value || ""} className={inputClass} data-testid="input-telegram-handle" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="telegramId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-primary/90">텔레그램 사용자 ID (숫자)</FormLabel>
                      <FormControl>
                        <Input placeholder="123456789" {...field} className={inputClass} data-testid="input-telegram-id" />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">텔레그램 @userinfobot 등을 통해 확인 가능한 숫자 ID입니다.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="birthDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-primary/90">생년월일</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className={inputClass} data-testid="input-birth-date" />
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
                          <Input type="time" {...field} className={inputClass} data-testid="input-birth-time" />
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className={inputClass} data-testid="select-gender">
                              <SelectValue placeholder="성별 선택" />
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
                        <FormLabel className="text-primary/90">MBTI (선택)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger className={inputClass} data-testid="select-mbti">
                              <SelectValue placeholder="MBTI 선택" />
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
                        <FormLabel className="text-primary/90">출생 국가 (선택)</FormLabel>
                        <FormControl>
                          <Input placeholder="대한민국" {...field} value={field.value || ""} className={inputClass} data-testid="input-birth-country" />
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
                        <FormLabel className="text-primary/90">출생 도시 (선택)</FormLabel>
                        <FormControl>
                          <Input placeholder="서울" {...field} value={field.value || ""} className={inputClass} data-testid="input-birth-city" />
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
                        <Input type="time" {...field} className={inputClass} data-testid="input-delivery-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  variant="mystical" 
                  size="lg" 
                  className="w-full mt-4"
                  disabled={createUser.isPending}
                  data-testid="button-submit-register"
                >
                  {createUser.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 별들을 정렬하는 중...
                    </>
                  ) : (
                    <>
                      운명 연결하기 <ArrowRight className="ml-2 h-4 w-4" />
                    </>
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

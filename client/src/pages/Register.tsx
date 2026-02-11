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
import { ArrowRight, Moon, Sun, Loader2 } from "lucide-react";

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createUser = useCreateUser();

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      name: "",
      telegramId: "",
      birthDate: "",
      birthTime: "",
      gender: "male",
    },
  });

  const onSubmit = (data: InsertUser) => {
    createUser.mutate(data, {
      onSuccess: (user) => {
        toast({
          title: "Destiny Awaits",
          description: `Welcome, ${user.name}. Your chart has been mapped.`,
        });
        setLocation(`/dashboard/${user.telegramId}`);
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Alignment Error",
          description: error.message,
        });
      },
    });
  };

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
            <h2 className="text-3xl font-serif text-glow mb-2">Begin Your Journey</h2>
            <p className="text-muted-foreground">
              Provide your details to align the stars. Your Telegram ID ensures daily delivery.
            </p>
          </div>

          <div className="glass-panel p-8 rounded-2xl">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-primary/90">Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Orion Blackwood" {...field} className="bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telegramId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-primary/90">Telegram Username (without @)</FormLabel>
                      <FormControl>
                        <Input placeholder="orion_stars" {...field} className="bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50" />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Search for our bot on Telegram to start receiving messages.</p>
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
                        <FormLabel className="text-primary/90">Birth Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="bg-black/20 border-white/10 text-white focus:border-primary/50" />
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
                        <FormLabel className="text-primary/90">Birth Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} className="bg-black/20 border-white/10 text-white focus:border-primary/50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-primary/90">Energy</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-black/20 border-white/10 text-white focus:border-primary/50">
                            <SelectValue placeholder="Select energy type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-secondary border-primary/20 text-white">
                          <SelectItem value="male"><span className="flex items-center gap-2"><Sun className="w-4 h-4" /> Male / Yang</span></SelectItem>
                          <SelectItem value="female"><span className="flex items-center gap-2"><Moon className="w-4 h-4" /> Female / Yin</span></SelectItem>
                        </SelectContent>
                      </Select>
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
                >
                  {createUser.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aligning Stars...
                    </>
                  ) : (
                    <>
                      Connect Destiny <ArrowRight className="ml-2 h-4 w-4" />
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

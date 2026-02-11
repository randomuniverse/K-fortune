import { useRoute, useLocation } from "wouter";
import { useUser, useGenerateFortune, useFortunes } from "@/hooks/use-fortune";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { FortuneCard } from "@/components/FortuneCard";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [match, params] = useRoute("/dashboard/:telegramId");
  const [, setLocation] = useLocation();
  const telegramId = params?.telegramId || "";
  
  const { data: user, isLoading: isUserLoading, error: userError } = useUser(telegramId);
  const { data: fortunes, isLoading: isFortunesLoading } = useFortunes(telegramId);
  const generateFortune = useGenerateFortune();
  const { toast } = useToast();

  if (isUserLoading) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground animate-pulse">Consulting the oracles...</p>
        </div>
      </Layout>
    );
  }

  if (!user || userError) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto text-center">
          <AlertCircle className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-2xl font-serif text-white mb-2">User Not Found</h2>
          <p className="text-muted-foreground mb-8">
            The stars cannot locate a traveler with ID <span className="text-primary font-mono">{telegramId}</span>.
          </p>
          <Button variant="outline" onClick={() => setLocation("/")}>Return Home</Button>
        </div>
      </Layout>
    );
  }

  const handleGenerate = () => {
    generateFortune.mutate(telegramId, {
      onSuccess: () => {
        toast({
          title: "Fortune Revealed",
          description: "The stars have spoken. Check your new reading.",
        });
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Connection Severed",
          description: error.message,
        });
      },
    });
  };

  return (
    <Layout>
      <div className="space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif text-white mb-1">
              Welcome, <span className="text-primary text-glow">{user.name}</span>
            </h2>
            <p className="text-muted-foreground">
              Born {user.birthDate} at {user.birthTime} • {user.gender === 'male' ? 'Yang' : 'Yin'} Energy
            </p>
          </div>
          
          <Button 
            variant="mystical" 
            size="lg" 
            onClick={handleGenerate}
            disabled={generateFortune.isPending}
            className="w-full md:w-auto min-w-[200px]"
          >
            {generateFortune.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Divining...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" /> Reveal Today's Fate
              </>
            )}
          </Button>
        </div>

        {/* Content Section */}
        <div className="grid gap-8">
          <div className="flex items-center gap-4">
             <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent flex-1" />
             <h3 className="text-xl font-serif text-primary/80 uppercase tracking-widest text-sm">Destiny Log</h3>
             <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent flex-1" />
          </div>

          {isFortunesLoading ? (
             <div className="flex justify-center py-12">
               <Loader2 className="w-8 h-8 text-primary/50 animate-spin" />
             </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {fortunes && fortunes.length > 0 ? (
                  fortunes.map((fortune, idx) => (
                    <FortuneCard key={fortune.id} fortune={fortune} index={idx} />
                  ))
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="col-span-full py-16 text-center glass-panel rounded-xl"
                  >
                    <p className="text-muted-foreground text-lg mb-4">Your fate remains unwritten.</p>
                    <Button variant="link" onClick={handleGenerate} className="text-primary">
                      Cast the first stone
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { XCircle, ArrowLeft } from "lucide-react";
import logo from "@/assets/localxpress-logo.jpeg";

const Cancel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <header className="bg-card/80 backdrop-blur-sm border-b border-border py-4 px-4">
        <div className="max-w-4xl mx-auto flex justify-center">
          <img src={logo} alt="LocalXpress" className="h-14 w-auto object-contain" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full shadow-lg border-2 border-border/50">
          <CardContent className="pt-12 pb-12 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Pago cancelado</h1>
              <p className="text-muted-foreground">
                No se ha procesado ningún cobro. Puedes volver al formulario cuando quieras.
              </p>
            </div>

            <Button
              size="lg"
              className="font-semibold gap-2"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al formulario
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Cancel;

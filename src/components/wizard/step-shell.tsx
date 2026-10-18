import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight } from "lucide-react";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  onNext?: () => void | Promise<void>;
  nextDisabled?: boolean;
  nextLabel?: string;
  prevPath?: string;
  loading?: boolean;
  extraActions?: ReactNode;
};

export function StepShell({
  title,
  description,
  children,
  onNext,
  nextDisabled,
  nextLabel = "Continuar",
  prevPath,
  loading,
  extraActions,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <Card>
        <CardContent className="pt-6">{children}</CardContent>
      </Card>
      <div className="flex items-center justify-between">
        <div>
          {prevPath && (
            <Button asChild variant="ghost">
              <Link to={prevPath}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {extraActions}
          {onNext && (
            <Button onClick={onNext} disabled={nextDisabled || loading}>
              {nextLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

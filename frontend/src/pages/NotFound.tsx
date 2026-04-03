import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: requested path:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="bg-grid-subtle flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-md shadow-slate-900/10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted/50">
          <ShieldOff className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Error 404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page <span className="font-mono text-foreground/80">{location.pathname}</span> does not exist or was
          moved.
        </p>
        <Button className="mt-6 w-full" asChild>
          <Link to="/">Return to home</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;

import { Toaster as Sonner } from "sonner";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";

// Toasts in the app's own dark glass style (styles.css, ".app-toast"):
// a coloured edge and icon per kind instead of sonner's light defaults.
const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="dark"
      position="top-right"
      closeButton
      duration={4500}
      visibleToasts={4}
      offset={{ top: 84, right: 20 }}
      mobileOffset={{ top: 72, left: 12, right: 12 }}
      icons={{
        success: <CheckCircle2 className="h-[18px] w-[18px]" />,
        error: <XCircle className="h-[18px] w-[18px]" />,
        warning: <AlertTriangle className="h-[18px] w-[18px]" />,
        info: <Info className="h-[18px] w-[18px]" />,
        loading: <Loader2 className="h-[18px] w-[18px] animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "app-toast",
          description: "app-toast-description",
          actionButton: "app-toast-action",
          cancelButton: "app-toast-cancel",
          closeButton: "app-toast-close",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

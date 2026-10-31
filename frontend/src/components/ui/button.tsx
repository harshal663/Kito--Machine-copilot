import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "destructive" | "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none min-h-[44px] min-w-[44px] px-4 py-2 select-none";

    const variantStyles: Record<string, string> = {
      primary:
        "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring shadow-sm",
      default:
        "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring shadow-sm",
      secondary:
        "bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-ring border border-border",
      danger:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive shadow-sm",
      destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive shadow-sm",
      outline:
        "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground text-foreground focus-visible:ring-ring",
      ghost:
        "hover:bg-accent hover:text-accent-foreground text-foreground focus-visible:ring-ring",
    };

    const sizeStyles: Record<string, string> = {
      sm: "text-xs min-h-[44px] px-3",
      md: "text-sm min-h-[44px] px-4",
      lg: "text-base min-h-[48px] px-6",
      icon: "h-11 w-11 min-h-[44px] min-w-[44px] p-2",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

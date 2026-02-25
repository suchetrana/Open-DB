import { clsx } from "clsx";

interface IconProps {
  name: string;
  className?: string;
  size?: number;
}

/**
 * Thin wrapper around Google Material Symbols Outlined.
 * Keeps icon usage consistent and easy to swap later.
 */
export function Icon({ name, className, size = 24 }: IconProps) {
  return (
    <span
      className={clsx("material-symbols-outlined select-none", className)}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}

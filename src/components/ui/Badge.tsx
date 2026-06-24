import './Badge.css';

type BadgeVariant = 'active' | 'inactive' | 'danger' | 'permission' | 'role';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({ children, variant = 'permission', className = '', style }: BadgeProps) {
  return (
    <span className={`badge badge--${variant} ${className}`} style={style}>
      {children}
    </span>
  );
}

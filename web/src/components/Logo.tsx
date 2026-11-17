import classes from './Logo.module.css';

export function Logo({ tamano = 24 }: { tamano?: number }) {
  return (
    <span className={classes.logo} style={{ fontSize: tamano }}>
      <span className={classes.quilate}>Quilate</span>
      <span className={classes.ar}>AR</span>
    </span>
  );
}
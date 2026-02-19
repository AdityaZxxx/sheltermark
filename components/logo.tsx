import Image from "next/image";
import { cn } from "../lib/utils";

interface LogoProps {
  style?: React.CSSProperties;
  className?: string;
  width?: number;
  height?: number;
}

const Logo = ({ style, className, width, height }: LogoProps) => {
  return (
    <>
      <Image
        src="/logo-light.svg"
        alt="Sheltermark logo"
        width={width || 42}
        height={height || 42}
        className={cn(`rounded-full dark:hidden ${className || ""}`)}
        style={style}
        priority
        fetchPriority="auto"
      />
      <Image
        src="/logo-dark.svg"
        alt="Sheltermark logo"
        width={width || 42}
        height={height || 42}
        className={cn(`hidden rounded-full dark:block ${className || ""}`)}
        style={style}
        priority
        fetchPriority="auto"
      />
    </>
  );
};

export default Logo;

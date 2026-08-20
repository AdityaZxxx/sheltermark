interface YCIconProps {
  className?: string;
  size?: string;
}

export function YCIcon({ className, size = "32" }: YCIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
      viewBox="0 0 512 512"
      fill="currentColor"
    >
      <title>Y Combinator</title>
      <rect width="512" height="512" fill="#f60" rx="15%" />
      <path d="M126 113h49l81 164 81-165h49L274 314v134h-42V314z" fill="#fff" />
    </svg>
  );
}

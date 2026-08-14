import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  h1: ({ node, ...props }) => (
    <h1
      className="mb-3 mt-4 text-lg font-semibold text-ink-100 first:mt-0"
      {...props}
    />
  ),
  h2: ({ node, ...props }) => (
    <h2
      className="mb-2.5 mt-4 text-base font-semibold text-ink-100 first:mt-0"
      {...props}
    />
  ),
  h3: ({ node, ...props }) => (
    <h3
      className="mb-2 mt-3 text-[15px] font-semibold text-ink-100 first:mt-0"
      {...props}
    />
  ),
  h4: ({ node, ...props }) => (
    <h4
      className="mb-2 mt-3 text-sm font-semibold text-ink-100 first:mt-0"
      {...props}
    />
  ),
  h5: ({ node, ...props }) => (
    <h5
      className="mb-2 mt-3 text-sm font-semibold text-ink-100 first:mt-0"
      {...props}
    />
  ),
  h6: ({ node, ...props }) => (
    <h6
      className="mb-2 mt-3 text-sm font-semibold text-ink-100 first:mt-0"
      {...props}
    />
  ),
  p: ({ node, ...props }) => (
    <p
      className="mb-3 leading-6 text-ink-200 last:mb-0"
      {...props}
    />
  ),
  ul: ({ node, ...props }) => (
    <ul
      className="mb-3 list-disc space-y-1 pl-5 text-ink-200 last:mb-0 [&>li>p]:mb-0 [&>li>ul]:mb-0 [&>li>ol]:mb-0"
      {...props}
    />
  ),
  ol: ({ node, ...props }) => (
    <ol
      className="mb-3 list-decimal space-y-1 pl-5 text-ink-200 last:mb-0 [&>li>p]:mb-0 [&>li>ul]:mb-0 [&>li>ol]:mb-0"
      {...props}
    />
  ),
  li: ({ node, ...props }) => <li className="leading-6" {...props} />,
  blockquote: ({ node, ...props }) => (
    <blockquote
      className="mb-3 border-l-2 border-cyan-500/50 bg-cyan-500/[0.05] py-1 pl-3 text-ink-300 last:mb-0"
      {...props}
    />
  ),
  hr: ({ node, ...props }) => (
    <hr className="my-3 border-ink-700/40" {...props} />
  ),
  a: ({ node, href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
      {...props}
    >
      {children}
    </a>
  ),
  code: ({ node, className, children, ...props }) => {
    const isBlock = /language-/.test(className ?? "");
    return (
      <code
        className={
          isBlock
            ? "block font-mono text-[13px] leading-5 text-ink-100"
            : "rounded border border-ink-700/30 bg-ink-800/80 px-1.5 py-0.5 font-mono text-[13px] text-cyan-300"
        }
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ node, children, ...props }) => (
    <pre
      className="mb-3 overflow-x-auto rounded-md border border-ink-700/30 bg-ink-900/80 p-3 text-[13px] leading-5 last:mb-0"
      {...props}
    >
      {children}
    </pre>
  ),
  table: ({ node, children, ...props }) => (
    <div className="mb-3 overflow-x-auto rounded-md border border-ink-700/30 last:mb-0">
      <table
        className="w-full border-collapse text-sm text-ink-200"
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ node, children, ...props }) => (
    <thead className="bg-ink-900/70 text-left" {...props}>
      {children}
    </thead>
  ),
  th: ({ node, children, ...props }) => (
    <th
      className="border-b border-ink-700/40 px-3 py-2 font-semibold text-ink-100"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ node, children, ...props }) => (
    <td
      className="border-b border-ink-700/25 px-3 py-2 align-top"
      {...props}
    >
      {children}
    </td>
  ),
  tr: ({ node, children, ...props }) => (
    <tr className="last:border-0" {...props}>
      {children}
    </tr>
  ),
  img: ({ node, src, alt, ...props }) => (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="mb-3 max-w-full rounded-md border border-ink-700/30 last:mb-0"
      {...props}
    />
  ),
  input: ({ node, ...props }) => (
    <input className="mr-1.5 h-3.5 w-3.5 accent-signal-500" {...props} />
  ),
};

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="min-w-0 text-[15px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText } from "lucide-react";
import type { UIMessage } from "ai";

type MessageContentProps = {
  parts: UIMessage["parts"];
};

/** Renders the text, Markdown, and uploaded-file parts of a chat message. */
export default function MessageContent({ parts }: MessageContentProps) {
  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "text") {
          return (
            <ReactMarkdown
              key={index}
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="mb-4 mt-6 text-2xl font-bold">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-3 mt-5 text-xl font-semibold">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-2 mt-4 text-lg font-semibold">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="mb-4 leading-7 last:mb-0">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-4 ml-6 list-disc space-y-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-4 ml-6 list-decimal space-y-2">
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li className="pl-1">{children}</li>,
                strong: ({ children }) => (
                  <strong className="font-bold text-white">{children}</strong>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="my-4 border-l-4 border-gray-500 pl-4 text-gray-300">
                    {children}
                  </blockquote>
                ),
                code: ({ children, className }) => (
                  <code
                    className={`${className ?? ""} rounded bg-[#303030] px-1.5 py-1 font-mono text-sm text-gray-200`}
                  >
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="my-4 overflow-x-auto rounded-xl border border-[#424242] bg-[#111111] p-4">
                    {children}
                  </pre>
                ),
                table: ({ children }) => (
                  <div className="my-4 overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-[#424242] bg-[#303030] px-3 py-2 font-semibold">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-[#424242] px-3 py-2">
                    {children}
                  </td>
                ),
              }}
            >
              {part.text}
            </ReactMarkdown>
          );
        }

        if (part.type === "file") {
          return (
            <a
              key={index}
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              className="my-2 flex max-w-xs items-center gap-3 rounded-xl border border-[#424242] bg-[#303030] p-3 transition hover:bg-[#383838]"
            >
              <FileText size={24} className="shrink-0 text-gray-300" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {part.filename || "Attached file"}
                </p>
                <p className="text-xs text-gray-400">
                  {part.mediaType === "application/pdf"
                    ? "PDF · Uploaded"
                    : "File · Uploaded"}
                </p>
              </div>
            </a>
          );
        }

        return null;
      })}
    </>
  );
}

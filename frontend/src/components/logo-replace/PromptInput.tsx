"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface PromptBatchInputProps {
  defaultPrompt: string;
  onFillAll: (prompt: string) => void;
}

export function PromptBatchInput({ defaultPrompt, onFillAll }: PromptBatchInputProps) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [copied, setCopied] = useState(false);

  const handleFillAll = () => {
    if (!prompt.trim()) {
      toast.error("请输入提示词");
      return;
    }
    onFillAll(prompt);
    toast.success("已填充到所有任务");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  };

  const handleReset = () => {
    setPrompt(defaultPrompt);
    toast.success("已重置为默认提示词");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">提示词批量设置</h3>
          <p className="text-sm text-slate-500">设置默认提示词，点击"填充到所有"将应用到全部任务</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
            复制
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            重置默认
          </Button>
        </div>
      </div>

      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={5}
        placeholder="输入提示词..."
        className="resize-none"
      />

      <div className="flex justify-end">
        <Button onClick={handleFillAll}>填充到所有任务</Button>
      </div>
    </div>
  );
}

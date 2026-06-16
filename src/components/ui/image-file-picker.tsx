"use client";

import { useId, useState } from "react";
import { compressImageFile } from "@/lib/image-upload";
import { cn } from "@/lib/utils";

type ImageFilePickerProps = {
  onPick: (dataUrl: string) => void;
  onError?: (message: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  children: React.ReactNode;
};

export function ImageFilePicker({
  onPick,
  onError,
  onUploadingChange,
  disabled = false,
  className,
  inputClassName,
  children
}: ImageFilePickerProps) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const isDisabled = disabled || uploading;

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setUploading(true);
    onUploadingChange?.(true);

    try {
      const dataUrl = await compressImageFile(file);
      onPick(dataUrl);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Could not read image.");
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  return (
    <label
      htmlFor={inputId}
      className={cn("relative block", isDisabled ? "pointer-events-none opacity-60" : "cursor-pointer", className)}
    >
      <input
        id={inputId}
        type="file"
        accept="image/*"
        disabled={isDisabled}
        onChange={handleChange}
        className={cn("absolute inset-0 z-20 h-full w-full cursor-pointer opacity-[0.001]", inputClassName)}
      />
      {children}
    </label>
  );
}

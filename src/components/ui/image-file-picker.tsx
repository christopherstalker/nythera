"use client";

import { useId, useRef, useState } from "react";
import { AVATAR_IMAGE_ACCEPT, compressImageFile } from "@/lib/image-upload";
import { cn } from "@/lib/utils";

type ImageFilePickerProps = {
  onPick: (dataUrl: string) => void;
  onError?: (message: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
  children: React.ReactNode;
};

export function ImageFilePicker({
  onPick,
  onError,
  onUploadingChange,
  disabled = false,
  className,
  inputClassName,
  ariaLabel = "Choose image",
  children
}: ImageFilePickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const isDisabled = disabled || uploading;

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];

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
      input.value = "";
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  function openFileDialog() {
    if (isDisabled) return;

    const input = inputRef.current;
    if (!input) return;

    input.value = "";
    input.click();
  }

  return (
    <div className="relative block min-w-0">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={AVATAR_IMAGE_ACCEPT}
        disabled={disabled}
        onChange={handleChange}
        className={cn("sr-only", inputClassName)}
      />
      <button
        type="button"
        aria-label={ariaLabel}
        aria-controls={inputId}
        disabled={isDisabled}
        onClick={openFileDialog}
        className={cn(
          "block w-full min-w-0 appearance-none border-0 bg-transparent p-0 text-inherit",
          isDisabled ? "cursor-wait opacity-60" : "cursor-pointer",
          className
        )}
      >
        {children}
      </button>
    </div>
  );
}

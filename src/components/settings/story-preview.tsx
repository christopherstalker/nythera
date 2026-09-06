"use client";

import type { CSSProperties } from "react";
import { CHAT_SCENE_BACKGROUNDS, chatFontFamily, type ChatAppearance } from "@/lib/chat-appearance";
import { useCustomFontFace } from "@/hooks/use-custom-font";

export function StoryPreview({ appearance }: { appearance: ChatAppearance }) {
  useCustomFontFace(appearance.fontUrl, "Nythera Studio Preview");
  return (
    <div
      className="studio-scene"
      style={{
        background: CHAT_SCENE_BACKGROUNDS[appearance.scenePalette === "character" ? "moss" : appearance.scenePalette]
      }}
    >
      <div className="studio-scene-art" data-quiet={appearance.backgroundMode === "none"}>
        <div
          className="studio-scene-landscape"
          style={{ opacity: 1 - appearance.backgroundDim, filter: `blur(${appearance.backgroundBlur}px)` }}
          aria-hidden
        />
        <div>
          <small>CHAPTER ONE / AN UNEXPECTED MEETING</small>
          <h3>The last train home</h3>
        </div>
      </div>
      <div
        className="studio-scene-text"
        style={
          {
            fontFamily: chatFontFamily(appearance.fontUrl ? "Nythera Studio Preview" : appearance.fontFamily),
            fontSize: appearance.fontSize,
            fontWeight: appearance.fontWeight,
            lineHeight: appearance.lineHeight,
            color: appearance.textColor,
            "--studio-reading-width": `${Math.min(100, appearance.contentWidth / 12)}%`
          } as CSSProperties
        }
      >
        <p className="studio-speaker">
          <span>E</span> Elena Vale
        </p>
        <p>
          <em>The last train disappears into the evening mist.</em>
        </p>
        <p>“You came back.” Elena folds the letter, almost smiling.</p>
        <p className="studio-speaker">
          <span>A</span> Your persona
        </p>
        <p>“Some stories deserve another chapter.”</p>
      </div>
      <div className="studio-scene-reply">
        Write what happens next… <span aria-hidden>↗</span>
      </div>
    </div>
  );
}

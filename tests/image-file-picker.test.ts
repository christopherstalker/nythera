import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AVATAR_IMAGE_ACCEPT,
  compressImageFile,
  isSupportedAvatarImageFile
} from "../src/lib/image-upload";

test("avatar picker accepts modern browser image formats and rejects active or unsupported files", () => {
  for (const [name, type] of [
    ["avatar.jpg", "image/jpeg"],
    ["avatar.png", "image/png"],
    ["avatar.webp", "image/webp"],
    ["avatar.gif", "image/gif"],
    ["avatar.avif", "image/avif"],
    ["avatar.bmp", "image/bmp"]
  ]) {
    assert.equal(isSupportedAvatarImageFile({ name, type }), true, `${name} should be accepted`);
  }

  assert.equal(isSupportedAvatarImageFile({ name: "avatar.avif", type: "" }), true);
  assert.equal(isSupportedAvatarImageFile({ name: "avatar.svg", type: "image/svg+xml" }), false);
  assert.equal(isSupportedAvatarImageFile({ name: "avatar.tiff", type: "image/tiff" }), false);
  assert.match(AVATAR_IMAGE_ACCEPT, /image\/webp/);
  assert.match(AVATAR_IMAGE_ACCEPT, /image\/gif/);
  assert.match(AVATAR_IMAGE_ACCEPT, /image\/avif/);
  assert.match(AVATAR_IMAGE_ACCEPT, /image\/bmp/);
});

test("image picker opens from an explicit button and keeps the selected file readable", async () => {
  const source = await readFile(new URL("../src/components/ui/image-file-picker.tsx", import.meta.url), "utf8");
  const changeHandler = source.slice(source.indexOf("async function handleChange"), source.indexOf("function openFileDialog"));
  const openDialog = source.slice(source.indexOf("function openFileDialog"), source.indexOf("return ("));

  assert.match(source, /<button[\s\S]*?type="button"[\s\S]*?onClick=\{openFileDialog\}/);
  assert.match(source, /<input[\s\S]*?ref=\{inputRef\}[\s\S]*?className=\{cn\("sr-only"/);
  assert.doesNotMatch(source, /opacity-\[0\.001\]/);
  assert.doesNotMatch(changeHandler, /event\.(?:target|currentTarget)\.value = ""/);
  assert.match(changeHandler, /finally \{[\s\S]*?input\.value = ""/);
  assert.match(openDialog, /input\.value = "";[\s\S]*?input\.click\(\)/);
  assert.match(source, /disabled=\{disabled\}/);
  assert.match(source, /accept=\{AVATAR_IMAGE_ACCEPT\}/);
});

test("image compression does not pre-read Android content-provider files", async () => {
  const createImageBitmapDescriptor = Object.getOwnPropertyDescriptor(globalThis, "createImageBitmap");
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  let sliceCalled = false;

  const file = {
    name: "avatar.jpg",
    type: "image/jpeg",
    size: 2_048,
    slice() {
      sliceCalled = true;
      throw new DOMException("The requested file could not be read.", "NotReadableError");
    }
  } as unknown as File;

  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    value: async () => ({ width: 800, height: 600, close() {} })
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement() {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage() {} }),
          toDataURL: () => "data:image/jpeg;base64,YXZhdGFy"
        };
      }
    }
  });

  try {
    const dataUrl = await compressImageFile(file);

    assert.equal(dataUrl, "data:image/jpeg;base64,YXZhdGFy");
    assert.equal(sliceCalled, false);
  } finally {
    restoreGlobal("createImageBitmap", createImageBitmapDescriptor);
    restoreGlobal("document", documentDescriptor);
  }
});

test("avatar upload errors stay beside the portrait field", async () => {
  const source = await readFile(new URL("../src/components/characters/character-form.tsx", import.meta.url), "utf8");

  assert.match(source, /<Field label="Portrait" error=\{avatarError\}>/);
  assert.match(source, /id="character-avatar"[\s\S]*?onError=\{revealAvatarError\}/);
  assert.match(source, /role="alert" aria-live="assertive"/);
  assert.match(source, /avatarField\?\.scrollIntoView/);
});

function restoreGlobal(key: string, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(globalThis, key, descriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, key);
}

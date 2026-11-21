"use client";

import { ImagePlus, Star, Undo2, X } from "lucide-react";
import { useId, useState } from "react";
import { ItemThumbnail } from "./item-thumbnail";
import {
  MAX_PICTURES_PER_ITEM,
  PICTURE_ACCEPT,
  pictureProblem,
  type ItemPicture,
  type NewPicture,
  type PictureChanges,
} from "./item-picture-rules";

interface ItemPictureFieldProps {
  name: string;
  /** The stored pictures, the cover first. */
  stored: ItemPicture[];
  changes: PictureChanges;
  onChange: (changes: PictureChanges) => void;
  /** Shows a stored picture first everywhere (saved at once); absent on a new item. */
  onMakePrimary?: (pictureId: string) => Promise<void>;
}

const readPreview = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}. Choose it again.`));
    reader.readAsDataURL(file);
  });

const tileButton =
  "absolute top-1 right-1 flex size-6 items-center justify-center rounded-md bg-ground/90 text-ink shadow-sm hover:bg-ground focus-visible:outline-2 focus-visible:outline-brand";

// Add, preview and remove the item's pictures (for sending to clients).
// Nothing is uploaded here: the changes go with the form's Save, like every
// other field. The first picture kept is the item's cover in lists.
export function ItemPictureField({ name, stored, changes, onChange, onMakePrimary }: ItemPictureFieldProps) {
  const inputId = useId();
  const [problems, setProblems] = useState<string[]>([]);
  const kept = stored.length - changes.removed.length + changes.added.length;
  const room = MAX_PICTURES_PER_ITEM - kept;
  const label = name || "this item";

  const pick = async (files: File[]) => {
    const found: string[] = [];
    const fit = files.filter((file) => {
      const reason = pictureProblem(file);
      if (reason) found.push(reason);
      return !reason;
    });
    if (fit.length > room) found.push(`Only ${MAX_PICTURES_PER_ITEM} pictures per item; ${fit.length - room} left out.`);
    const added: NewPicture[] = [];
    for (const file of fit.slice(0, Math.max(room, 0))) {
      try {
        added.push({ key: crypto.randomUUID(), file, preview: await readPreview(file) });
      } catch (error) {
        found.push((error as Error).message);
      }
    }
    setProblems(found);
    if (added.length > 0) onChange({ ...changes, added: [...changes.added, ...added] });
  };

  const toggleStored = (id: string) =>
    onChange({
      ...changes,
      removed: changes.removed.includes(id) ? changes.removed.filter((removed) => removed !== id) : [...changes.removed, id],
    });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted">Pictures</span>
      <ul className="flex flex-wrap gap-2.5" aria-label={`Pictures of ${label}`}>
        {stored.map((picture, index) => {
          const removed = changes.removed.includes(picture.id);
          return (
            <li key={picture.id} className="relative">
              <ItemThumbnail
                src={picture.url}
                alt={`Picture ${index + 1} of ${label}`}
                size={96}
                className={removed ? "opacity-35 grayscale" : undefined}
              />
              <button
                type="button"
                className={tileButton}
                aria-label={removed ? `Keep picture ${index + 1}` : `Remove picture ${index + 1}`}
                onClick={() => toggleStored(picture.id)}
              >
                {removed ? <Undo2 aria-hidden="true" className="size-4" /> : <X aria-hidden="true" className="size-4" />}
              </button>
              {index === 0 && !removed && (
                <span className="absolute bottom-1 left-1 rounded-full bg-brand px-1.5 py-0.5 text-[10.5px] font-semibold text-white">Main</span>
              )}
              {index > 0 && !removed && onMakePrimary && (
                <button
                  type="button"
                  className="absolute bottom-1 left-1 flex size-7 items-center justify-center rounded-full bg-white/90 text-brand-strong shadow hover:bg-brand-tint"
                  aria-label={`Make picture ${index + 1} the main picture`}
                  title="Make this the main picture"
                  onClick={() => void onMakePrimary(picture.id)}
                >
                  <Star aria-hidden="true" className="size-4" />
                </button>
              )}
            </li>
          );
        })}
        {changes.added.map((picture) => (
          <li key={picture.key} className="relative">
            <ItemThumbnail src={picture.preview} alt={`New picture ${picture.file.name}`} size={96} className="ring-2 ring-brand/50" />
            <button
              type="button"
              className={tileButton}
              aria-label={`Leave out ${picture.file.name}`}
              onClick={() => onChange({ ...changes, added: changes.added.filter((other) => other.key !== picture.key) })}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </li>
        ))}
        {room > 0 && (
          <li>
            <label
              htmlFor={inputId}
              className="glass-control glass-press flex size-24 cursor-pointer flex-col items-center justify-center gap-1 text-[12px] font-semibold text-brand focus-within:outline-2 focus-within:outline-brand hover:bg-brand-tint/60"
            >
              <ImagePlus aria-hidden="true" className="size-5" />
              Add pictures
              <input
                id={inputId}
                type="file"
                multiple
                accept={PICTURE_ACCEPT}
                className="sr-only"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  void pick(files);
                }}
              />
            </label>
          </li>
        )}
      </ul>
      <p className="text-[11.5px] text-muted">
        JPEG, PNG or WebP, up to 1 MB each and {MAX_PICTURES_PER_ITEM} per item, for sending to clients. The main picture shows everywhere; the star makes another one main.
        Saved with the item.
      </p>
      {problems.length > 0 && (
        <ul role="alert" className="text-xs font-semibold text-danger-strong">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {changes.removed.length > 0 && (
        <p className="text-xs font-semibold text-muted">
          {changes.removed.length === 1 ? "1 picture is" : `${changes.removed.length} pictures are`} removed when you save.
        </p>
      )}
    </div>
  );
}

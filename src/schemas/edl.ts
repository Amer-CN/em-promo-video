import {z} from "zod";

export const edlMetaSchema = z
  .object({
    width: z.literal(1080),
    height: z.literal(1920),
    fps: z.literal(30),
    title: z.string().min(1),
    voiceoverDurationSec: z.number().min(0).optional(),
  })
  .strict();

export const focusRectSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  })
  .strict();

export const kenBurnsSchema = z
  .object({
    from: z.number().min(1),
    to: z.number().min(1),
  })
  .strict();

export const subtitleSchema = z
  .object({
    text: z.string().min(1),
    start: z.number().min(0),
    end: z.number(),
  })
  .strict();

export const clipSchema = z
  .object({
    id: z.string().min(1),
    assetId: z.string().min(1),
    type: z.enum(["video", "image", "html"]),
    sourceIn: z.number().min(0).optional(),
    sourceOut: z.number().optional(),
    timelineStart: z.number().min(0),
    duration: z.number().positive(),
    fit: z.enum(["cover", "contain", "focus"]),
    focusRect: focusRectSchema.optional(),
    kenBurns: kenBurnsSchema.optional(),
    subtitles: z.array(subtitleSchema).optional(),
  })
  .strict();

export const edlSchema = z
  .object({
    meta: edlMetaSchema,
    clips: z.array(clipSchema).min(1),
  })
  .strict();

export type EdlMeta = z.infer<typeof edlMetaSchema>;
export type FocusRect = z.infer<typeof focusRectSchema>;
export type KenBurns = z.infer<typeof kenBurnsSchema>;
export type Subtitle = z.infer<typeof subtitleSchema>;
export type Clip = z.infer<typeof clipSchema>;
export type Edl = z.infer<typeof edlSchema>;

// ---- manifest (content/manifest.json) entries ----
export const manifestEntrySchema = z
  .object({
    id: z.string().min(1),
    path: z.string().min(1),
    type: z.enum(["video", "image", "html"]),
    durationSec: z.number().nullable(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    fps: z.number().nullable(),
    hasAudio: z.boolean().nullable(),
    segments: z
      .array(
        z
          .object({
            start: z.number(),
            end: z.number(),
          })
          .strict(),
      )
      .optional(),
    thumbnails: z.array(z.string()).optional(),
  })
  .strict();

export type ManifestEntry = z.infer<typeof manifestEntrySchema>;



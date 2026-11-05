import { DEFAULT_KNOBS } from "@/demos/playground/store";
import type { Knobs } from "@/demos/playground/store";
import { ROLE_CLASSES } from "@/lib/doc/code-theme";

type Role = keyof typeof ROLE_CLASSES;

type Run = readonly [string, Role];

type Piece = readonly [string, string];

type Painted = readonly (readonly Piece[])[];

type Entry = readonly [string, number | readonly Entry[]];

type Literal =
  | { kind: "bare" }
  | { kind: "expression"; role: Role; text: string }
  | { kind: "object"; entries: readonly Entry[] }
  | { kind: "string"; text: string };

type Attribute = readonly [string, Literal];

type Element = {
  attributes: readonly Attribute[];
  children: readonly Element[];
  tag: string;
};

type RootChanges = Partial<
  Pick<Knobs, "dir" | "disabled" | "maxZoom" | "motion" | "recenterDelay">
>;

type ViewportChanges = Partial<Pick<Knobs, "rotateGesture" | "wheel">>;

const WIDTH = 64;

const INDENT = "  ";

const JSON_TOKEN =
  /(?<key>"(?:[^"\\]|\\.)*")(?=\s*:)|(?<text>"(?:[^"\\]|\\.)*")|(?<number>-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(?<punct>[{}[\],:])|(?<plain>\s*(?:true|false|null)|\s+|[^\s"{}[\],:-]+)/gu;

const escape = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const mergeLine = (runs: readonly Run[]): Piece[] => {
  const merged: [string, string][] = [];

  for (const [part, role] of runs) {
    if (part === "") {
      continue;
    }

    const blank = part.trim() === "";
    const last = merged.at(-1);

    if (last !== undefined && (blank || last[1] === ROLE_CLASSES[role])) {
      last[0] += part;
    } else {
      merged.push([part, blank ? "" : ROLE_CLASSES[role]]);
    }
  }

  return merged;
};

const piecesHtml = (lines: Painted): string =>
  lines
    .map((pieces) =>
      pieces
        .map(([part, name]) =>
          name === ""
            ? escape(part)
            : `<span class=${name}>${escape(part)}</span>`
        )
        .join("")
    )
    .join("\n");

const linesText = (lines: readonly (readonly Run[])[]): string =>
  lines.map((runs) => runs.map(([text]) => text).join("")).join("\n");

const runsWidth = (runs: readonly Run[]): number =>
  runs.reduce((sum, [part]) => sum + part.length, 0);

const text = (value: string): Literal => ({ kind: "string", text: value });

const numberRuns = (value: number): Run[] =>
  value < 0
    ? [
        ["-", "punct"],
        [String(-value), "number"],
      ]
    : [[String(value), "number"]];

const numberOf = (value: number): Literal => ({
  kind: "expression",
  role: "number",
  text: String(value),
});

const entryRuns = ([key, value]: Entry, lead: string): Run[] => [
  [`${lead}${key}`, "plain"],
  [":", "punct"],
  [" ", "plain"],
  ...(typeof value === "number"
    ? numberRuns(value)
    : [
        ["{", "punct"] as const,
        ...value.flatMap((entry, i): Run[] => [
          ...(i > 0 ? [[",", "punct"] as const] : []),
          ...entryRuns(entry, " "),
        ]),
        [" ", "plain"] as const,
        ["}", "punct"] as const,
      ]),
];

const objectRuns = (entries: readonly Entry[]): Run[] =>
  entries.flatMap((entry, i): Run[] => [
    ...(i > 0 ? [[",", "punct"] as const] : []),
    ...entryRuns(entry, " "),
  ]);

const literalRuns = (literal: Literal): Run[] => {
  if (literal.kind === "bare") {
    return [];
  }

  if (literal.kind === "string") {
    return [
      ["=", "punct"],
      ['"', "punct"],
      [literal.text, "string"],
      ['"', "punct"],
    ];
  }

  if (literal.kind === "expression") {
    return [
      ["={", "punct"],
      ...(literal.text.startsWith("-")
        ? [
            ["-", "punct"] as const,
            [literal.text.slice(1), literal.role] as const,
          ]
        : [[literal.text, literal.role] as const]),
      ["}", "punct"],
    ];
  }

  return [
    ["={{", "punct"],
    ...objectRuns(literal.entries),
    [" ", "plain"],
    ["}}", "punct"],
  ];
};

const attributeRuns = ([name, literal]: Attribute): Run[] => [
  [name, "attr"],
  ...literalRuns(literal),
];

const attributeLines = (attribute: Attribute, pad: string): Run[][] => {
  const line: Run[] = [[pad, "plain"], ...attributeRuns(attribute)];
  const [name, literal] = attribute;

  if (runsWidth(line) <= WIDTH || literal.kind !== "object") {
    return [line];
  }

  return [
    [
      [pad, "plain"],
      [name, "attr"],
      ["={{", "punct"],
    ],
    ...literal.entries.map((entry): Run[] => [
      ...entryRuns(entry, `${pad}${INDENT}`),
      [",", "punct"],
    ]),
    [
      [pad, "plain"],
      ["}}", "punct"],
    ],
  ];
};

const elementLines = (element: Element, depth: number): Run[][] => {
  const pad = INDENT.repeat(depth);
  const leaf = element.children.length === 0;
  const close: Run[] = leaf
    ? [
        [" ", "plain"],
        ["/>", "punct"],
      ]
    : [[">", "punct"]];
  const open: Run[] = [
    [pad, "plain"],
    ["<", "punct"],
    [element.tag, "tag"],
    ...element.attributes.flatMap((attribute): Run[] => [
      [" ", "plain"],
      ...attributeRuns(attribute),
    ]),
    ...close,
  ];
  const head =
    runsWidth(open) <= WIDTH
      ? [open]
      : [
          [
            [pad, "plain"],
            ["<", "punct"],
            [element.tag, "tag"],
          ] satisfies Run[],
          ...element.attributes.flatMap((attribute) =>
            attributeLines(attribute, `${pad}${INDENT}`)
          ),
          [
            [pad, "plain"],
            [leaf ? "/>" : ">", "punct"],
          ] satisfies Run[],
        ];

  if (leaf) {
    return head;
  }

  return [
    ...head,
    ...element.children.flatMap((child) => elementLines(child, depth + 1)),
    [
      [pad, "plain"],
      ["</", "punct"],
      [element.tag, "tag"],
      [">", "punct"],
    ],
  ];
};

const rootChanges = (knobs: Knobs): RootChanges => ({
  ...(knobs.motion === DEFAULT_KNOBS.motion ? {} : { motion: knobs.motion }),
  ...(knobs.dir === DEFAULT_KNOBS.dir ? {} : { dir: knobs.dir }),
  ...(knobs.maxZoom === DEFAULT_KNOBS.maxZoom
    ? {}
    : { maxZoom: knobs.maxZoom }),
  ...(knobs.recenterDelay === DEFAULT_KNOBS.recenterDelay
    ? {}
    : { recenterDelay: knobs.recenterDelay }),
  ...(knobs.disabled ? { disabled: true } : {}),
});

const viewportChanges = (knobs: Knobs): ViewportChanges => ({
  ...(knobs.wheel === DEFAULT_KNOBS.wheel ? {} : { wheel: knobs.wheel }),
  ...(knobs.rotateGesture ? {} : { rotateGesture: false }),
});

const leaf = (tag: string, ...attributes: Attribute[]): Element => ({
  attributes,
  children: [],
  tag,
});

const rootAttributes = (knobs: Knobs): Attribute[] => {
  const changes = rootChanges(knobs);
  const tilted = knobs.vertical !== 0 || knobs.horizontal !== 0;

  return [
    ["src", { kind: "expression", role: "plain", text: "photo" }],
    ...(knobs.shape === DEFAULT_KNOBS.shape
      ? []
      : [["shape", text(knobs.shape)] as const]),
    ...(changes.motion === undefined
      ? []
      : [["motion", text(changes.motion)] as const]),
    ...(changes.dir === undefined ? [] : [["dir", text(changes.dir)] as const]),
    ...(changes.maxZoom === undefined
      ? []
      : [["maxZoom", numberOf(changes.maxZoom)] as const]),
    ...(changes.recenterDelay === undefined
      ? []
      : [["recenterDelay", numberOf(changes.recenterDelay)] as const]),
    ...(changes.disabled === true
      ? [["disabled", { kind: "bare" }] as const]
      : []),
    ...(tilted
      ? [
          [
            "defaultValue",
            {
              entries: [
                [
                  "perspective",
                  [
                    ["vertical", knobs.vertical],
                    ["horizontal", knobs.horizontal],
                  ],
                ],
              ],
              kind: "object",
            },
          ] as const,
        ]
      : []),
  ];
};

const viewportAttributes = (knobs: Knobs): Attribute[] => {
  const changes = viewportChanges(knobs);

  return [
    ...(changes.wheel === undefined
      ? []
      : [["wheel", text(changes.wheel)] as const]),
    ...(changes.rotateGesture === false
      ? [
          [
            "rotateGesture",
            { kind: "expression", role: "number", text: "false" },
          ] as const,
        ]
      : []),
    ["style", { entries: [["height", 380]], kind: "object" }] as const,
  ];
};

const treeOf = (knobs: Knobs): Element => ({
  attributes: rootAttributes(knobs),
  children: [
    {
      attributes: viewportAttributes(knobs),
      children: [
        leaf("Cropper.Image"),
        leaf("Cropper.Mask"),
        leaf("Cropper.Area", ["aria-label", text("Crop area")]),
      ],
      tag: "Cropper.Viewport",
    },
    leaf("Cropper.Rotate", ["aria-label", text("Rotate left")]),
    leaf("Cropper.DialValue"),
    {
      attributes: [["aria-label", text("Straighten")]],
      children: [leaf("Cropper.DialTicks")],
      tag: "Cropper.Dial",
    },
    leaf("Cropper.Flip", ["aria-label", text("Flip")]),
  ],
  tag: "Cropper.Root",
});

const codeLines = (knobs: Knobs): Run[][] => elementLines(treeOf(knobs), 0);

const codeText = (knobs: Knobs): string => linesText(codeLines(knobs));

const codePieces = (knobs: Knobs): Painted => codeLines(knobs).map(mergeLine);

const codeHtml = (knobs: Knobs): string => piecesHtml(codePieces(knobs));

const jsonRuns = (line: string): Run[] =>
  [...line.matchAll(JSON_TOKEN)].flatMap((match): Run[] => {
    const { key, number, punct, text: string } = match.groups ?? {};

    if (key !== undefined) {
      return [
        ['"', "punct"],
        [key.slice(1, -1), "attr"],
        ['"', "punct"],
      ];
    }

    if (string !== undefined) {
      return [[string, "string"]];
    }

    if (number !== undefined) {
      return [[number, "number"]];
    }

    if (punct !== undefined) {
      return [[punct, "punct"]];
    }

    return [[match[0], "plain"]];
  });

const jsonText = (value: unknown): string => JSON.stringify(value, null, 2);

const jsonPieces = (source: string): Painted =>
  source.split("\n").map((line) => mergeLine(jsonRuns(line)));

const jsonHtml = (source: string): string => piecesHtml(jsonPieces(source));

export type { Painted, Piece, RootChanges, ViewportChanges };
export {
  codeHtml,
  codePieces,
  codeText,
  jsonHtml,
  jsonPieces,
  jsonText,
  rootChanges,
  viewportChanges,
};

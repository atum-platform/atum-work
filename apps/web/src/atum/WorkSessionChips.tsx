import type { WorkDocumentFormat } from "@t3tools/contracts";
import { useGT } from "gt-react";
import {
  ChevronDownIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PaletteIcon,
  PlusIcon,
  PresentationIcon,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../components/ui/menu";

type WorkStartProps = {
  disabled: boolean;
  onChoose: (format: WorkDocumentFormat) => Promise<void>;
};

function useWorkFormats() {
  const gt = useGT();
  return {
    docx: { format: "docx", label: gt("Document"), chip: gt("Write"), Icon: FileTextIcon },
    xlsx: {
      format: "xlsx",
      label: gt("Spreadsheet"),
      chip: gt("Analyze numbers"),
      Icon: FileSpreadsheetIcon,
    },
    pptx: { format: "pptx", label: gt("Slides"), chip: gt("Slides"), Icon: PresentationIcon },
    svg: { format: "svg", label: gt("Design"), chip: gt("Design"), Icon: PaletteIcon },
  } as const;
}

export function WorkCreateMenu({ disabled, onChoose }: WorkStartProps) {
  const gt = useGT();
  const formats = useWorkFormats();
  return (
    <Menu>
      <MenuTrigger
        disabled={disabled}
        render={<Button type="button" size="sm-pill" variant="ghost" />}
      >
        <PlusIcon aria-hidden />
        {gt("Create")}
        <ChevronDownIcon aria-hidden />
      </MenuTrigger>
      <MenuPopup align="start" side="top">
        {Object.values(formats).map(({ format, label, Icon }) => (
          <MenuItem key={format} onClick={() => void onChoose(format)}>
            <Icon aria-hidden className="size-4" />
            {label}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}

export function WorkSessionChips({ disabled, onChoose }: WorkStartProps) {
  const { docx, svg, pptx, xlsx } = useWorkFormats();
  return (
    <div className="flex flex-wrap justify-center gap-2 pt-3" data-atum-work-session-chips="">
      {[docx, svg, xlsx, pptx].map(({ format, chip, Icon }) => (
        <Button
          key={format}
          type="button"
          size="sm-pill"
          variant="secondary"
          disabled={disabled}
          onClick={() => void onChoose(format)}
        >
          <Icon aria-hidden />
          {chip}
        </Button>
      ))}
    </div>
  );
}

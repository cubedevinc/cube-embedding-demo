import { useState } from 'react';
import { Code, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface UserAttribute {
  name: string;
  value: string | number;
}

// Preserves numeric values entered in the UI (e.g. tenantId 1851) so they are
// sent as JSON numbers; the round-trip check keeps inputs like "007" as strings.
function coerceValue(raw: string): string | number {
  const trimmed = raw.trim();
  if (trimmed !== '' && String(Number(trimmed)) === trimmed) {
    return Number(trimmed);
  }
  return raw;
}

interface AttributeBuilderProps {
  value: string;
  onChange: (value: string) => void;
}

function parseAttributes(raw: string): UserAttribute[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

function serializeAttributes(attrs: UserAttribute[]): string {
  const filtered = attrs.filter((a) => a.name.trim() || String(a.value).trim());
  if (filtered.length === 0) return '';
  return JSON.stringify(filtered);
}

export function AttributeBuilder({ value, onChange }: AttributeBuilderProps) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState('');

  const attributes = parseAttributes(value);

  const updateAttributes = (newAttrs: UserAttribute[]) => {
    onChange(serializeAttributes(newAttrs));
  };

  const addRow = () => {
    onChange(JSON.stringify([...attributes, { name: '', value: '' }]));
  };

  const removeRow = (index: number) => {
    updateAttributes(attributes.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: 'name' | 'value', val: string) => {
    const updated = [...attributes];
    updated[index] = {
      ...updated[index],
      [field]: field === 'value' ? coerceValue(val) : val,
    };
    onChange(JSON.stringify(updated));
  };

  const openJsonEditor = () => {
    setJsonDraft(value ? JSON.stringify(parseAttributes(value), null, 2) : '[\n  { "name": "", "value": "" }\n]');
    setJsonError('');
    setJsonOpen(true);
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonDraft);
      if (!Array.isArray(parsed)) {
        setJsonError('Must be a JSON array');
        return;
      }
      for (const item of parsed) {
        if (
          typeof item.name !== 'string' ||
          (typeof item.value !== 'string' && typeof item.value !== 'number')
        ) {
          setJsonError('Each item must have a "name" string and a "value" string or number');
          return;
        }
      }
      onChange(serializeAttributes(parsed));
      setJsonOpen(false);
    } catch (e) {
      setJsonError('Invalid JSON');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">User Attributes</Label>
        <div className="flex items-center gap-1">
          <Dialog open={jsonOpen} onOpenChange={setJsonOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={openJsonEditor}>
                <Code className="h-3 w-3" />
                JSON
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Attributes as JSON</DialogTitle>
                <DialogDescription>
                  Array of {'{"name": "...", "value": "..."}'} objects — values can be strings or numbers
                </DialogDescription>
              </DialogHeader>
              <textarea
                value={jsonDraft}
                onChange={(e) => {
                  setJsonDraft(e.target.value);
                  setJsonError('');
                }}
                className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                spellCheck={false}
              />
              {jsonError && (
                <p className="text-xs text-destructive">{jsonError}</p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setJsonOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={applyJson}>
                  Apply
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={addRow}>
            <Plus className="h-3 w-3" />
            Add
          </Button>
        </div>
      </div>

      {attributes.length > 0 && (
        <div className="space-y-1.5">
          {attributes.map((attr, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                placeholder="name"
                value={attr.name}
                onChange={(e) => updateRow(i, 'name', e.target.value)}
                className="flex-1 text-xs h-7"
              />
              <Input
                placeholder="value"
                value={attr.value}
                onChange={(e) => updateRow(i, 'value', e.target.value)}
                className="flex-1 text-xs h-7"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeRow(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

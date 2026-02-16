'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportToCSV } from '@/lib/export';

interface ExportButtonProps<T extends Record<string, any>> {
  data: T[];
  filename: string;
  columns: { key: keyof T; header: string }[];
}

export function ExportButton<T extends Record<string, any>>({
  data,
  filename,
  columns,
}: ExportButtonProps<T>) {
  const handleExport = () => {
    exportToCSV(data, filename, columns);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
}

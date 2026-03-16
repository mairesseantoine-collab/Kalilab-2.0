import React, { useRef, useState } from 'react';
import { Box, Typography, Button, LinearProgress } from '@mui/material';
import { CloudUpload, InsertDriveFile } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface Props {
  onFileSelect: (file: File) => void;
  accept?: string;
  loading?: boolean;
  label?: string;
}

const FileUpload: React.FC<Props> = ({ onFileSelect, accept = '*', loading = false, label }) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = (file: File) => {
    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <Box
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      sx={{
        border: '2px dashed',
        borderColor: dragging ? 'primary.main' : 'divider',
        borderRadius: 2,
        p: 3,
        textAlign: 'center',
        bgcolor: dragging ? 'primary.light' : 'background.default',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {selectedFile ? (
        <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
          <InsertDriveFile color="primary" />
          <Typography variant="body2">{selectedFile.name}</Typography>
        </Box>
      ) : (
        <>
          <CloudUpload sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {label || t('common.upload')} (glisser-deposer ou cliquer)
          </Typography>
        </>
      )}
      {loading && <LinearProgress sx={{ mt: 1 }} />}
    </Box>
  );
};

export default FileUpload;

import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';

interface ProcessMediaProps {
  userToken: string;
  apiUrl: string;
}

interface AnalysisResult {
  objects: Array<{ label: string; score: number }>;
  text: string;
  tokens_used: number;
}

export const ProcessMedia: React.FC<ProcessMediaProps> = ({ userToken, apiUrl }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      setFile(acceptedFiles[0]);
      setResult(null);
    },
  });

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${apiUrl}/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Processing failed');
      }

      const data = await response.json();
      setResult(data);
      toast.success('Processing completed successfully!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
        }`}
      >
        <input {...getInputProps()} />
        {file ? (
          <div>
            <p className="text-lg font-medium">{file.name}</p>
            <p className="text-sm text-gray-500">
              {(file.size / 1024).toFixed(2)} KB
            </p>
          </div>
        ) : (
          <div>
            <p className="text-lg font-medium">
              {isDragActive ? 'Drop the file here' : 'Drag & drop a file here, or click to select'}
            </p>
            <p className="text-sm text-gray-500">
              Supports images (JPEG, PNG), PDFs, and text files
            </p>
          </div>
        )}
      </div>

      {file && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setFile(null)}
            className="mr-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
          <button
            onClick={processFile}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-md text-white ${
              isProcessing ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isProcessing ? 'Processing...' : 'Process File'}
          </button>
        </div>
      )}

      {result && (
        <div className="mt-8 p-6 bg-white rounded-lg shadow">
          <h3 className="text-xl font-bold mb-4">Analysis Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Detected Objects</h4>
              <ul className="space-y-2">
                {result.objects.map((obj, index) => (
                  <li key={index} className="flex justify-between">
                    <span>{obj.label}</span>
                    <span className="text-gray-600">{(obj.score * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Extracted Text</h4>
              <div className="p-3 bg-gray-50 rounded-md">
                <p className="whitespace-pre-line">{result.text}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t text-sm text-gray-500">
            Tokens used: {result.tokens_used} (${(result.tokens_used * 0.00025).toFixed(2)})
          </div>
        </div>
      )}
    </div>
  );
};
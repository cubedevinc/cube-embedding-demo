import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Select } from './components/ui/select';
import { Alert, AlertDescription } from './components/ui/alert';
import { Info } from 'lucide-react';

const CUBE_API_URL = import.meta.env.VITE_CUBE_API_URL || 'http://localhost:4280';
const LOCAL_SERVER_URL = window.location.origin;

interface UserAttribute {
  name: string;
  value: string;
}

function App() {
  const [deploymentId, setDeploymentId] = useState('');
  const [externalId, setExternalId] = useState('test-user-123');
  const [embedType, setEmbedType] = useState<'chat' | 'dashboard'>('chat');
  const [dashboardId, setDashboardId] = useState('');
  const [userAttributes, setUserAttributes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [iframeError, setIframeError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setEmbedUrl(null);

    if (embedType === 'dashboard' && !dashboardId.trim()) {
      setError('Dashboard Public ID is required for dashboard embedding');
      return;
    }

    let parsedAttributes: UserAttribute[] | null = null;
    if (userAttributes.trim()) {
      try {
        parsedAttributes = JSON.parse(userAttributes);
        if (!Array.isArray(parsedAttributes)) {
          throw new Error('User attributes must be an array');
        }
      } catch (err) {
        setError(`Invalid user attributes JSON: ${err instanceof Error ? err.message : 'Unknown error'}`);
        return;
      }
    }

    setLoading(true);

    try {
      const requestBody: {
        deploymentId: number;
        externalId: string;
        userAttributes?: UserAttribute[];
      } = {
        deploymentId: parseInt(deploymentId),
        externalId: externalId,
      };

      if (parsedAttributes) {
        requestBody.userAttributes = parsedAttributes;
      }

      const sessionResponse = await fetch(`${LOCAL_SERVER_URL}/api/v1/embed/generate-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.text();
        throw new Error(
          `Failed to generate session: ${sessionResponse.status} ${sessionResponse.statusText}\n${errorData}`,
        );
      }

      const sessionData = await sessionResponse.json();
      const newSessionId = sessionData.sessionId;

      if (!newSessionId) {
        throw new Error('Session ID not found in response: ' + JSON.stringify(sessionData));
      }

      setSessionId(newSessionId);

      // Build embed URL
      let url: string;
      if (embedType === 'chat') {
        url = `${CUBE_API_URL}/embed/chat?sessionId=${newSessionId}`;
      } else {
        url = `${CUBE_API_URL}/embed/dashboard/${dashboardId}?session=${newSessionId}`;
      }

      setEmbedUrl(url);
      setIframeError(null); // Clear any previous iframe errors
      setSuccess(`Session generated successfully! Session ID: ${newSessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* Left Panel - Configuration (25% width) */}
        <div className="w-[25%] min-w-[320px] border-r border-border overflow-y-auto">
          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <img src="/cubejs-logo.svg" alt="Cube Logo" className="h-8" />
                <h1 className="text-2xl font-semibold">Cube Embedding Demo</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Test signed embedding functionality for Cube dashboards and chat
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1 text-xs">
                  <div>
                    <strong>Server:</strong> {CUBE_API_URL}
                  </div>
                  <div>
                    <strong>API Key:</strong> Configured
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deploymentId">Deployment ID *</Label>
                <Input
                  id="deploymentId"
                  type="number"
                  required
                  placeholder="e.g., 32"
                  value={deploymentId}
                  onChange={(e) => setDeploymentId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="externalId">External ID *</Label>
                <Input
                  id="externalId"
                  type="text"
                  required
                  placeholder="e.g., user@example.com"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="embedType">Embed Type</Label>
                <Select
                  id="embedType"
                  value={embedType}
                  onChange={(e) => setEmbedType(e.target.value as 'chat' | 'dashboard')}
                >
                  <option value="chat">Chat</option>
                  <option value="dashboard">Dashboard</option>
                </Select>
              </div>

              {embedType === 'dashboard' && (
                <div className="space-y-2">
                  <Label htmlFor="dashboardId">Dashboard Public ID *</Label>
                  <Input
                    id="dashboardId"
                    type="text"
                    required={embedType === 'dashboard'}
                    placeholder="Required for dashboard embedding"
                    value={dashboardId}
                    onChange={(e) => setDashboardId(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="userAttributes">User Attributes (JSON, optional)</Label>
                <Input
                  id="userAttributes"
                  type="text"
                  placeholder='[{"name":"city","value":"San Francisco"}]'
                  value={userAttributes}
                  onChange={(e) => setUserAttributes(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Format: {'[{"name":"attributeName","value":"attributeValue"}]'}
                </p>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Generating session...' : 'Generate Session & Embed'}
              </Button>
            </form>

            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert variant="success">
                <AlertDescription className="text-xs">{success}</AlertDescription>
              </Alert>
            )}

            {embedUrl && (
              <div className="space-y-2">
                <Label>Embed URL</Label>
                <div className="rounded-lg border bg-muted/50 p-2">
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {embedUrl}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Embed Area (75% width) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-border p-4">
            <h2 className="text-lg font-semibold">Embedded Content</h2>
            <p className="text-sm text-muted-foreground">
              {embedUrl ? 'Preview of the embedded dashboard or chat' : 'Generate a session to see the embedded content'}
            </p>
          </div>
          <div className="flex-1 relative bg-muted/30">
            {iframeError && (
              <div className="absolute top-4 left-4 right-4 z-10">
                <Alert variant="destructive">
                  <AlertDescription>
                    <strong>Iframe Error:</strong> {iframeError}
                  </AlertDescription>
                </Alert>
              </div>
            )}
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title="Embedded Content"
                className="w-full h-full border-0"
                allowTransparency
                allowFullScreen
                onError={() => setIframeError('Failed to load iframe content. Check the console for details.')}
                onLoad={() => setIframeError(null)}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <div className="text-muted-foreground">
                    <svg
                      className="mx-auto h-12 w-12 text-muted-foreground/50"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground">No embed content yet</p>
                  <p className="text-xs text-muted-foreground">Fill out the form and click "Generate Session & Embed"</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

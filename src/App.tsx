import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { RadioGroup, RadioGroupItem } from './components/ui/radio-group';
import { Alert, AlertDescription } from './components/ui/alert';
import { Info, RefreshCw, ChevronLeft, ChevronRight, Menu } from 'lucide-react';

const CUBE_API_URL = import.meta.env.VITE_CUBE_API_URL;
const LOCAL_SERVER_URL = window.location.origin;

if (!CUBE_API_URL) {
  throw new Error('CUBE_API_URL environment variable is required. Please set it in your .env file or build configuration.');
}

interface UserAttribute {
  name: string;
  value: string;
}

const STORAGE_KEY = 'cube-embedding-config';

interface SavedConfig {
  deploymentId: string;
  userIdType: 'external' | 'internal';
  externalId: string;
  internalId: string;
  embedType: 'chat' | 'dashboard' | 'app';
  dashboardId: string;
  userAttributes: string;
  embedAfterGeneration: boolean;
  menuCollapsed?: boolean;
}

function App() {
  // Load saved config from localStorage on mount
  const loadSavedConfig = (): Partial<SavedConfig> => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const config = JSON.parse(saved);
        // Migrate old 'home' value to 'app'
        if (config.embedType === 'home') {
          config.embedType = 'app';
        }
        return config;
      }
    } catch (err) {
      console.warn('Failed to load saved config from localStorage:', err);
    }
    return {};
  };

  const savedConfig = loadSavedConfig();

  const [deploymentId, setDeploymentId] = useState(savedConfig.deploymentId || '');
  const [userIdType, setUserIdType] = useState<'external' | 'internal'>(savedConfig.userIdType || 'external');
  const [externalId, setExternalId] = useState(savedConfig.externalId || 'test-user-123');
  const [internalId, setInternalId] = useState(savedConfig.internalId || '');
  const [embedType, setEmbedType] = useState<'chat' | 'dashboard' | 'app'>(savedConfig.embedType || 'chat');
  const [dashboardId, setDashboardId] = useState(savedConfig.dashboardId || '');
  const [userAttributes, setUserAttributes] = useState(savedConfig.userAttributes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [displayEmbedUrl, setDisplayEmbedUrl] = useState<string | null>(null);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [embedAfterGeneration, setEmbedAfterGeneration] = useState(savedConfig.embedAfterGeneration ?? true);
  const [menuCollapsed, setMenuCollapsed] = useState(savedConfig.menuCollapsed ?? false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Save config to localStorage whenever it changes
  useEffect(() => {
    try {
      const config: SavedConfig = {
        deploymentId,
        userIdType,
        externalId,
        internalId,
        embedType,
        dashboardId,
        userAttributes,
        embedAfterGeneration,
        menuCollapsed,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (err) {
      console.warn('Failed to save config to localStorage:', err);
    }
  }, [deploymentId, userIdType, externalId, internalId, embedType, dashboardId, userAttributes, embedAfterGeneration, menuCollapsed]);

  const generateSession = async (clearErrors = true) => {
    if (clearErrors) {
      setError(null);
      setSuccess(null);
      setEmbedUrl(null);
      setDisplayEmbedUrl(null);
    }

    if (embedType === 'dashboard' && !dashboardId.trim()) {
      setError('Dashboard Public ID is required for dashboard embedding');
      return;
    }

    // Validate that either externalId or internalId is provided
    if (userIdType === 'external' && !externalId.trim()) {
      setError('External ID is required');
      return;
    }
    if (userIdType === 'internal' && !internalId.trim()) {
      setError('Internal ID (email) is required');
      return;
    }

    // Parse user attributes only for external users (not allowed with internalId)
    let parsedAttributes: UserAttribute[] | null = null;
    if (userIdType === 'external' && userAttributes.trim()) {
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
        externalId?: string;
        internalId?: string;
        userAttributes?: UserAttribute[];
        creatorMode?: boolean;
      } = {
        deploymentId: parseInt(deploymentId),
      };

      // Include either externalId or internalId (not both)
      if (userIdType === 'external') {
        requestBody.externalId = externalId;
        if (parsedAttributes) {
          requestBody.userAttributes = parsedAttributes;
        }
      } else {
        requestBody.internalId = internalId;
        // userAttributes are not allowed with internalId per API docs
      }

      // Add creatorMode for app embed type
      if (embedType === 'app') {
        requestBody.creatorMode = true;
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

      // Build embed URL (always build it for display)
      // Format: /embed/d/:deploymentId/{chat|dashboard/:publicId|app}?session=sessionId
      let url: string;
      if (embedType === 'chat') {
        url = `${CUBE_API_URL}/embed/d/${deploymentId}/chat?session=${newSessionId}`;
      } else if (embedType === 'dashboard') {
        url = `${CUBE_API_URL}/embed/d/${deploymentId}/dashboard/${dashboardId}?session=${newSessionId}`;
      } else {
        // app
        url = `${CUBE_API_URL}/embed/d/${deploymentId}/app?session=${newSessionId}`;
      }

      // Always store the URL for display
      setDisplayEmbedUrl(url);

      // Only set embedUrl if embedding is enabled (for iframe rendering)
      if (embedAfterGeneration) {
        setEmbedUrl(url);
        setIframeError(null); // Clear any previous iframe errors
      } else {
        setEmbedUrl(null);
      }

      setSuccess(`Session generated successfully! Session ID: ${newSessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await generateSession(true);
  };

  const handleRefresh = async () => {
    if (!deploymentId) {
      setError('Please fill in Deployment ID before refreshing');
      return;
    }
    if (userIdType === 'external' && !externalId) {
      setError('Please fill in External ID before refreshing');
      return;
    }
    if (userIdType === 'internal' && !internalId) {
      setError('Please fill in Internal ID before refreshing');
      return;
    }
    await generateSession(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen relative">
        {/* Left Panel - Configuration (25% width) */}
        <div
          className={`${
            menuCollapsed ? 'w-0 overflow-hidden' : 'w-[25%] min-w-[320px]'
          } border-r border-border overflow-y-auto transition-all duration-300 ease-in-out relative bg-gray-50 dark:bg-gray-900`}
        >
          {/* Collapse arrow button at the top */}
          {!menuCollapsed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMenuCollapsed(true)}
              className="absolute right-0 top-4 -translate-x-1/2 z-10 h-8 w-8 rounded-full p-0 border-2 bg-background shadow-md hover:bg-accent"
              title="Collapse menu"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <img src="/cubejs-logo.svg" alt="Cube Logo" className="h-8" />
                <h1 className="text-2xl font-semibold">Cube Embedding Demo</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Test signed embedding functionality for Cube dashboards, chat, and app
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
                <Label>User ID Type *</Label>
                <RadioGroup
                  value={userIdType}
                  onValueChange={(value) => {
                    setUserIdType(value as 'external' | 'internal');
                    // Clear user attributes when switching to internal (not allowed)
                    if (value === 'internal') {
                      setUserAttributes('');
                    }
                  }}
                  className="flex gap-2"
                >
                  <RadioGroupItem value="external" id="userIdType-external" className="flex-1">
                    External ID
                  </RadioGroupItem>
                  <RadioGroupItem value="internal" id="userIdType-internal" className="flex-1">
                    Internal ID
                  </RadioGroupItem>
                </RadioGroup>
              </div>

              {userIdType === 'external' ? (
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
                  <p className="text-xs text-muted-foreground">
                    Unique identifier for the external user
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="internalId">Internal ID (Email) *</Label>
                  <Input
                    id="internalId"
                    type="email"
                    required
                    placeholder="e.g., user@example.com"
                    value={internalId}
                    onChange={(e) => setInternalId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Email address of an internal Cube Cloud user (must exist in Cube Cloud)
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Embed Type</Label>
                <RadioGroup
                  value={embedType}
                  onValueChange={(value) => setEmbedType(value as 'chat' | 'dashboard' | 'app')}
                  className="flex gap-2"
                >
                  <RadioGroupItem value="chat" id="embedType-chat" className="flex-1">
                    Chat
                  </RadioGroupItem>
                  <RadioGroupItem value="dashboard" id="embedType-dashboard" className="flex-1">
                    Dashboard
                  </RadioGroupItem>
                  <RadioGroupItem value="app" id="embedType-app" className="flex-1">
                    App
                  </RadioGroupItem>
                </RadioGroup>
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

              {userIdType === 'external' && (
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
              )}

              {userIdType === 'internal' && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    When using Internal ID, user attributes, groups, and security context are not allowed. The internal user's existing permissions are used instead.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="embedAfterGeneration"
                  checked={embedAfterGeneration}
                  onChange={(e) => setEmbedAfterGeneration(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="embedAfterGeneration" className="text-sm font-normal cursor-pointer">
                  Embed after generation
                </Label>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Generating session...' : embedAfterGeneration ? 'Generate Session & Embed' : 'Generate Session Only'}
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

            {displayEmbedUrl && (
              <div className="space-y-2">
                <Label>Embed URL</Label>
                <div className="rounded-lg border bg-muted/50 p-2">
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {displayEmbedUrl}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Embed Area (75% width) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-border p-4 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {menuCollapsed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMenuCollapsed(false)}
                    className="flex items-center gap-2"
                  >
                    <Menu className="h-4 w-4" />
                    Menu
                  </Button>
                )}
                <div>
                  <h2 className="text-lg font-semibold">Embedded Content</h2>
                  <p className="text-sm text-muted-foreground">
                    {embedUrl ? 'Preview of the embedded content' : 'Generate a session to see the embedded content'}
                  </p>
                </div>
              </div>
              {embedUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              )}
            </div>
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
                ref={iframeRef}
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

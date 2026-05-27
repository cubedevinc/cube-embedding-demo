import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Info,
  Menu,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from './components/ui/alert';
import { AttributeBuilder } from './components/attribute-builder';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';

const CUBE_API_URL = import.meta.env.VITE_CUBE_API_URL;
const CUBE_EMBED_URL = import.meta.env.VITE_CUBE_EMBED_URL || CUBE_API_URL;
const LOCAL_SERVER_URL = window.location.origin;

if (!CUBE_API_URL) {
  throw new Error(
    'CUBE_API_URL environment variable is required. Please set it in your .env file or build configuration.',
  );
}

interface UserAttribute {
  name: string;
  value: string;
}

const STORAGE_KEY = 'cube-embedding-config';

// Mirrors EMBED_TENANT_NAME_REGEX in console-server's GenerateSessionDTO so the
// UI rejects an invalid tenant name before it reaches the API.
const EMBED_TENANT_NAME_REGEX = /^[a-z][a-z0-9-]{3,34}[a-z0-9]$/;
const EMBED_TENANT_NAME_MESSAGE =
  'Tenant name must start with a letter, end with a letter or number, and contain only lowercase letters, numbers, or hyphens (length 5-36).';

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
  embedTenantName?: string;
  themeFont?: string;
  themePrimaryColor?: string;
  themeAnalyticsChatBackgroundColor?: string;
  themeAnalyticsChatInputBackgroundColor?: string;
  themeAnalyticsChatInputBorderColor?: string;
  groups?: string;
  theme?: 'light' | 'auto' | 'dark';
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

  const [deploymentId, setDeploymentId] = useState(
    savedConfig.deploymentId || '',
  );
  const [userIdType, setUserIdType] = useState<'external' | 'internal'>(
    savedConfig.userIdType || 'external',
  );
  const [externalId, setExternalId] = useState(
    savedConfig.externalId || 'test-user-123',
  );
  const [internalId, setInternalId] = useState(savedConfig.internalId || '');
  const [embedType, setEmbedType] = useState<'chat' | 'dashboard' | 'app'>(
    savedConfig.embedType || 'chat',
  );
  const [dashboardId, setDashboardId] = useState(savedConfig.dashboardId || '');
  const [userAttributes, setUserAttributes] = useState(
    savedConfig.userAttributes || '',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<string | null>(null);
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [displayEmbedUrl, setDisplayEmbedUrl] = useState<string | null>(null);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [embedAfterGeneration, setEmbedAfterGeneration] = useState(
    savedConfig.embedAfterGeneration ?? true,
  );
  const [menuCollapsed, setMenuCollapsed] = useState(
    savedConfig.menuCollapsed ?? false,
  );
  const [embedTenantName, setEmbedTenantName] = useState(
    savedConfig.embedTenantName || '',
  );
  const [embedTenantNameTouched, setEmbedTenantNameTouched] = useState(false);
  const [themeFont, setThemeFont] = useState(savedConfig.themeFont || '');
  const [themePrimaryColor, setThemePrimaryColor] = useState(
    savedConfig.themePrimaryColor || '',
  );
  const [
    themeAnalyticsChatBackgroundColor,
    setThemeAnalyticsChatBackgroundColor,
  ] = useState(savedConfig.themeAnalyticsChatBackgroundColor || '');
  const [
    themeAnalyticsChatInputBackgroundColor,
    setThemeAnalyticsChatInputBackgroundColor,
  ] = useState(savedConfig.themeAnalyticsChatInputBackgroundColor || '');
  const [
    themeAnalyticsChatInputBorderColor,
    setThemeAnalyticsChatInputBorderColor,
  ] = useState(savedConfig.themeAnalyticsChatInputBorderColor || '');
  const [groups, setGroups] = useState(savedConfig.groups || '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAnalyticsChat, setShowAnalyticsChat] = useState(false);
  const [theme, setTheme] = useState<'light' | 'auto' | 'dark'>(
    savedConfig.theme || 'auto',
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Tenant name is optional, but when provided (creator mode) it must satisfy
  // the same regex the API enforces — validate it before allowing submit.
  const trimmedEmbedTenantName = embedTenantName.trim();
  const embedTenantNameInvalid =
    embedType === 'app' &&
    trimmedEmbedTenantName.length > 0 &&
    !EMBED_TENANT_NAME_REGEX.test(trimmedEmbedTenantName);
  // Surface the error only once the field has been blurred, so we don't nag
  // mid-typing. Actual validity (above) still gates submit regardless.
  const showEmbedTenantNameError =
    embedTenantNameInvalid && embedTenantNameTouched;

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
        embedTenantName,
        themeFont,
        themePrimaryColor,
        themeAnalyticsChatBackgroundColor,
        themeAnalyticsChatInputBackgroundColor,
        themeAnalyticsChatInputBorderColor,
        groups,
        theme,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (err) {
      console.warn('Failed to save config to localStorage:', err);
    }
  }, [
    deploymentId,
    userIdType,
    externalId,
    internalId,
    embedType,
    dashboardId,
    userAttributes,
    embedAfterGeneration,
    menuCollapsed,
    embedTenantName,
    themeFont,
    themePrimaryColor,
    themeAnalyticsChatBackgroundColor,
    themeAnalyticsChatInputBackgroundColor,
    themeAnalyticsChatInputBorderColor,
    groups,
    theme,
  ]);

  // Send theme updates to iframe via PostMessage API
  useEffect(() => {
    if (iframeRef.current?.contentWindow && embedUrl) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'SET_THEME',
          payload: theme,
        },
        '*',
      );
    }
  }, [theme, embedUrl]);

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
    if (embedTenantNameInvalid) {
      setEmbedTenantNameTouched(true);
      setError(EMBED_TENANT_NAME_MESSAGE);
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
        setError(
          `Invalid user attributes JSON: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
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
        groups?: string[];
        creatorMode?: boolean;
        embedTenantName?: string;
        embedTheme?: {
          font?: string;
          primaryColor?: string;
          analyticsChat?: {
            backgroundColor?: string;
            chatInput?: {
              backgroundColor?: string;
              borderColor?: string;
            };
          };
        };
      } = {
        deploymentId: parseInt(deploymentId),
      };

      // Include either externalId or internalId (not both)
      if (userIdType === 'external') {
        requestBody.externalId = externalId;
        if (parsedAttributes) {
          requestBody.userAttributes = parsedAttributes;
        }
        const parsedGroups = groups
          .split(',')
          .map((g: string) => g.trim())
          .filter(Boolean);
        if (parsedGroups.length > 0) {
          requestBody.groups = parsedGroups;
        }
      } else {
        requestBody.internalId = internalId;
        // userAttributes are not allowed with internalId per API docs
      }

      // Add creatorMode for app embed type. embedTenantName is optional and
      // only sent when provided (already validated against the regex above).
      if (embedType === 'app') {
        requestBody.creatorMode = true;
        if (trimmedEmbedTenantName) {
          requestBody.embedTenantName = trimmedEmbedTenantName;
        }
      }

      // Add theme if any theme fields are provided
      const embedThemeConfig: {
        font?: string;
        primaryColor?: string;
        analyticsChat?: {
          backgroundColor?: string;
          chatInput?: {
            backgroundColor?: string;
            borderColor?: string;
          };
        };
      } = {};

      if (themeFont.trim()) {
        embedThemeConfig.font = themeFont.trim();
      }
      if (themePrimaryColor.trim()) {
        embedThemeConfig.primaryColor = themePrimaryColor.trim();
      }

      // Build analyticsChat object if any analytics chat fields are provided
      const analyticsChat: {
        backgroundColor?: string;
        chatInput?: {
          backgroundColor?: string;
          borderColor?: string;
        };
      } = {};

      if (themeAnalyticsChatBackgroundColor.trim()) {
        analyticsChat.backgroundColor =
          themeAnalyticsChatBackgroundColor.trim();
      }

      const chatInput: {
        backgroundColor?: string;
        borderColor?: string;
      } = {};

      if (themeAnalyticsChatInputBackgroundColor.trim()) {
        chatInput.backgroundColor =
          themeAnalyticsChatInputBackgroundColor.trim();
      }
      if (themeAnalyticsChatInputBorderColor.trim()) {
        chatInput.borderColor = themeAnalyticsChatInputBorderColor.trim();
      }

      if (chatInput.backgroundColor || chatInput.borderColor) {
        analyticsChat.chatInput = chatInput;
      }

      if (analyticsChat.backgroundColor || analyticsChat.chatInput) {
        embedThemeConfig.analyticsChat = analyticsChat;
      }

      // Only include embedTheme if at least one property is set
      if (
        embedThemeConfig.font ||
        embedThemeConfig.primaryColor ||
        embedThemeConfig.analyticsChat
      ) {
        requestBody.embedTheme = embedThemeConfig;
      }

      setLastPayload(JSON.stringify(requestBody, null, 2));

      const sessionResponse = await fetch(
        `${LOCAL_SERVER_URL}/api/v1/embed/generate-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.text();
        throw new Error(
          `Failed to generate session: ${sessionResponse.status} ${sessionResponse.statusText}\n${errorData}`,
        );
      }

      const sessionData = await sessionResponse.json();
      const newSessionId = sessionData.sessionId;

      if (!newSessionId) {
        throw new Error(
          'Session ID not found in response: ' + JSON.stringify(sessionData),
        );
      }

      setSessionId(newSessionId);

      // Build embed URL (always build it for display)
      // Format: /embed/d/:deploymentId/{chat|dashboard/:publicId|app}?session=sessionId
      let url: string;
      if (embedType === 'chat') {
        url = `${CUBE_EMBED_URL}/embed/d/${deploymentId}/chat?session=${newSessionId}`;
      } else if (embedType === 'dashboard') {
        url = `${CUBE_EMBED_URL}/embed/d/${deploymentId}/dashboard/${dashboardId}?session=${newSessionId}`;
      } else {
        // app
        url = `${CUBE_EMBED_URL}/embed/d/${deploymentId}/app?session=${newSessionId}`;
      }

      // Pin the current light/dark scheme on load via ?theme. The SET_THEME
      // postMessage (sent on change and on iframe load) overrides this at runtime.
      url += `&theme=${theme}`;

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
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred',
      );
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
          } border-r border-border overflow-y-auto transition-all duration-300 ease-in-out relative bg-muted/40`}
        >
          {/* Collapse arrow button at the top */}
          {!menuCollapsed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMenuCollapsed(true)}
              className="absolute right-0 top-3 -translate-x-1/2 z-10 h-7 w-7 rounded-full p-0 border-2 bg-background shadow-md hover:bg-accent"
              title="Collapse menu"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <img src="/cubejs-logo.svg" alt="Cube Logo" className="h-6" />
              <h1 className="text-lg font-semibold">Cube Embedding Demo</h1>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span><strong>Server:</strong> {CUBE_API_URL}</span>
              <span><strong>API Key:</strong> Configured</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center gap-3">
                <Label htmlFor="deploymentId" className="shrink-0 w-28 text-right">Deployment ID *</Label>
                <Input
                  id="deploymentId"
                  type="number"
                  required
                  placeholder="e.g., 32"
                  value={deploymentId}
                  onChange={(e) => setDeploymentId(e.target.value)}
                  className="flex-1"
                />
              </div>

              <div className="flex items-center gap-3">
                <Label className="shrink-0 w-28 text-right">User ID Type *</Label>
                <Tabs
                  value={userIdType}
                  onValueChange={(value) => {
                    setUserIdType(value as 'external' | 'internal');
                    if (value === 'internal') {
                      setUserAttributes('');
                      if (embedType === 'app') {
                        setEmbedType('chat');
                      }
                    }
                  }}
                  className="flex-1"
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="external" className="flex-1">
                      External ID
                    </TabsTrigger>
                    <TabsTrigger value="internal" className="flex-1">
                      Internal ID
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {userIdType === 'external' ? (
                <div className="flex items-center gap-3">
                  <Label htmlFor="externalId" className="shrink-0 w-28 text-right">External ID *</Label>
                  <Input
                    id="externalId"
                    type="text"
                    required
                    placeholder="e.g., user@example.com"
                    value={externalId}
                    onChange={(e) => setExternalId(e.target.value)}
                    className="flex-1"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Label htmlFor="internalId" className="shrink-0 w-28 text-right">Internal ID *</Label>
                  <Input
                    id="internalId"
                    type="email"
                    required
                    placeholder="e.g., user@example.com"
                    value={internalId}
                    onChange={(e) => setInternalId(e.target.value)}
                    className="flex-1"
                  />
                </div>
              )}

              <div className="flex items-center gap-3">
                <Label className="shrink-0 w-28 text-right">Embed Type</Label>
                <Tabs
                  value={embedType}
                  onValueChange={(value) =>
                    setEmbedType(value as 'chat' | 'dashboard' | 'app')
                  }
                  className="flex-1"
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="chat" className="flex-1">
                      Chat
                    </TabsTrigger>
                    <TabsTrigger value="dashboard" className="flex-1">
                      Dashboard
                    </TabsTrigger>
                    <TabsTrigger value="app" className="flex-1" disabled={userIdType === 'internal'}>
                      Creator Mode
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {embedType === 'dashboard' && (
                <div className="flex items-center gap-3">
                  <Label htmlFor="dashboardId" className="shrink-0 w-28 text-right">Dashboard ID *</Label>
                  <Input
                    id="dashboardId"
                    type="text"
                    required={embedType === 'dashboard'}
                    placeholder="Public ID for dashboard"
                    value={dashboardId}
                    onChange={(e) => setDashboardId(e.target.value)}
                    className="flex-1"
                  />
                </div>
              )}

              {embedType === 'app' && (
                <div className="flex items-start gap-3">
                  <Label
                    htmlFor="embedTenantName"
                    className="shrink-0 w-28 text-right pt-2"
                  >
                    Tenant Name
                  </Label>
                  <div className="flex-1 space-y-1">
                    <Input
                      id="embedTenantName"
                      type="text"
                      placeholder="embed-tenant-1"
                      value={embedTenantName}
                      onChange={(e) => setEmbedTenantName(e.target.value)}
                      onBlur={() => setEmbedTenantNameTouched(true)}
                      aria-invalid={showEmbedTenantNameError}
                      className={
                        showEmbedTenantNameError
                          ? 'border-destructive focus-visible:ring-destructive'
                          : ''
                      }
                    />
                    {showEmbedTenantNameError && (
                      <p className="text-xs text-destructive">
                        {EMBED_TENANT_NAME_MESSAGE}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {userIdType === 'external' && (
                <>
                  <div className="flex items-center gap-3">
                    <Label htmlFor="groups" className="shrink-0 w-28 text-right">Groups</Label>
                    <Input
                      id="groups"
                      type="text"
                      placeholder="admin, viewer"
                      value={groups}
                      onChange={(e) => setGroups(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <AttributeBuilder
                    value={userAttributes}
                    onChange={setUserAttributes}
                  />
                </>
              )}

              {userIdType === 'internal' && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    When using Internal ID, user attributes, groups, and
                    security context are not allowed. The internal user's
                    existing permissions are used instead.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center justify-between w-full text-sm font-medium text-foreground hover:text-accent-foreground"
                >
                  <span>App Customization</span>
                  {showAdvanced ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {showAdvanced && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowAnalyticsChat(!showAnalyticsChat)}
                      className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground pl-1"
                    >
                      <span>Analytics Chat</span>
                      {showAnalyticsChat ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                    {showAnalyticsChat && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Label htmlFor="themeAnalyticsChatBackgroundColor" className="shrink-0 w-28 text-right">Chat BG</Label>
                          <div className="flex gap-1 flex-1">
                            <Input
                              id="themeAnalyticsChatBackgroundColor"
                              type="text"
                              placeholder="#F8F9FA"
                              value={themeAnalyticsChatBackgroundColor}
                              onChange={(e) => setThemeAnalyticsChatBackgroundColor(e.target.value)}
                              className="flex-1"
                            />
                            {themeAnalyticsChatBackgroundColor && (
                              <div
                            className="w-7 h-7 rounded border border-border shrink-0"
                            style={{ backgroundColor: themeAnalyticsChatBackgroundColor }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Label htmlFor="themeAnalyticsChatInputBackgroundColor" className="shrink-0 w-28 text-right">Input BG</Label>
                          <div className="flex gap-1 flex-1">
                            <Input
                              id="themeAnalyticsChatInputBackgroundColor"
                              type="text"
                              placeholder="#FFFFFF"
                              value={themeAnalyticsChatInputBackgroundColor}
                              onChange={(e) => setThemeAnalyticsChatInputBackgroundColor(e.target.value)}
                              className="flex-1"
                            />
                            {themeAnalyticsChatInputBackgroundColor && (
                              <div
                            className="w-7 h-7 rounded border border-border shrink-0"
                            style={{ backgroundColor: themeAnalyticsChatInputBackgroundColor }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Label htmlFor="themeAnalyticsChatInputBorderColor" className="shrink-0 w-28 text-right">Input Border</Label>
                          <div className="flex gap-1 flex-1">
                            <Input
                              id="themeAnalyticsChatInputBorderColor"
                              type="text"
                              placeholder="#E0E0E0"
                              value={themeAnalyticsChatInputBorderColor}
                              onChange={(e) => setThemeAnalyticsChatInputBorderColor(e.target.value)}
                              className="flex-1"
                            />
                            {themeAnalyticsChatInputBorderColor && (
                              <div
                            className="w-7 h-7 rounded border border-border shrink-0"
                            style={{ backgroundColor: themeAnalyticsChatInputBorderColor }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3 flex items-center gap-3">
                <div className="shrink-0 w-28" />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="embedAfterGeneration"
                    checked={embedAfterGeneration}
                    onChange={(e) => setEmbedAfterGeneration(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <Label
                    htmlFor="embedAfterGeneration"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Embed after generation
                  </Label>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || showEmbedTenantNameError}
                className="w-full"
              >
                {loading
                  ? 'Generating session...'
                  : embedAfterGeneration
                    ? 'Generate Session & Embed'
                    : 'Generate Session Only'}
              </Button>
            </form>

            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert variant="success">
                <AlertDescription className="text-xs">
                  {success}
                </AlertDescription>
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

            {lastPayload && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setPayloadOpen(true)}
                >
                  Inspect Request Payload
                </Button>
                <Dialog open={payloadOpen} onOpenChange={setPayloadOpen}>
                  <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Request Payload</DialogTitle>
                      <DialogDescription>
                        JSON body sent to generate-session API
                      </DialogDescription>
                    </DialogHeader>
                    <pre className="flex-1 overflow-auto rounded-md border bg-muted/50 p-3 text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                      {lastPayload}
                    </pre>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {/* Right Panel - Embed Area (75% width) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-border p-4 bg-muted/40">
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
                    {embedUrl
                      ? 'Preview of the embedded content'
                      : 'Generate a session to see the embedded content'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Tabs
                  value={theme}
                  onValueChange={(value) =>
                    setTheme(value as 'light' | 'auto' | 'dark')
                  }
                >
                  <TabsList>
                    <TabsTrigger value="light" className="gap-1.5">
                      <Sun className="h-3.5 w-3.5" />
                      Light
                    </TabsTrigger>
                    <TabsTrigger value="auto" className="gap-1.5">
                      <Monitor className="h-3.5 w-3.5" />
                      Auto
                    </TabsTrigger>
                    <TabsTrigger value="dark" className="gap-1.5">
                      <Moon className="h-3.5 w-3.5" />
                      Dark
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
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
                onError={() =>
                  setIframeError(
                    'Failed to load iframe content. Check the console for details.',
                  )
                }
                onLoad={() => {
                  setIframeError(null);
                  iframeRef.current?.contentWindow?.postMessage(
                    { type: 'SET_THEME', payload: theme },
                    '*',
                  );
                }}
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
                  <p className="text-sm text-muted-foreground">
                    No embed content yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fill out the form and click "Generate Session & Embed"
                  </p>
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

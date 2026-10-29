import { GitBranch, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";

export type GitHubConnectionState = {
  configured: boolean;
  connected: boolean;
  login?: string;
  expires_at?: string;
};
export function GitHubConnection({
  connection,
  busy,
  onDisconnect,
}: {
  connection: GitHubConnectionState;
  busy: boolean;
  onDisconnect: () => void;
}) {
  return (
    <section className="panel github-connection">
      <div className="row">
        <GitBranch size={20} />
        <h2>Your GitHub connection</h2>
      </div>
      <p>
        Connect through the PhantomCommit GitHub App. Requests use your
        authorized account rather than a shared personal token. Only public
        repositories are supported.
      </p>
      {connection.connected ? (
        <>
          <p className="connection-status">
            <ShieldCheck size={15} /> Connected as @{connection.login}
          </p>
          <p>
            Connection expires{" "}
            {connection.expires_at
              ? new Date(connection.expires_at).toLocaleString()
              : "later"}
            . Reconnect when it expires.
          </p>
          <div className="row">
            <Button
              variant="outline"
              onClick={() =>
                window.location.assign(
                  new URL("/api/github/connect", window.location.origin).href,
                )
              }
            >
              Reconnect GitHub
            </Button>
            <Button variant="outline" disabled={busy} onClick={onDisconnect}>
              Disconnect this browser
            </Button>
          </div>
        </>
      ) : connection.configured ? (
        <Button
          onClick={() =>
            window.location.assign(
              new URL("/api/github/connect", window.location.origin).href,
            )
          }
        >
          <GitBranch size={16} /> Connect GitHub
        </Button>
      ) : (
        <p className="muted">
          GitHub App setup is not complete yet. Saved evidence remains
          available.
        </p>
      )}
    </section>
  );
}

import Logo from "~/components/logo";
import { getPastelHexColor } from "~/lib/utils";

type OGImageProps = {
  title?: string;
  description?: string;
  display_name?: string;
  username?: string;
  workspace?: string;
};

export function OGImage({
  title,
  description,
  display_name,
  username,
  workspace,
}: OGImageProps) {
  const hasUser = Boolean(username);
  const hasWorkspace = Boolean(username && workspace);

  // DEFAULT VARIANT (Centered)
  if (!hasUser) {
    return (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          padding: 80,
          fontFamily: "Inter, system-ui, sans-serif",
          color: "#171717",
          gap: 24,
        }}
      >
        <Logo size={160} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 16,
            maxWidth: 900,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            {title}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 700,
              color: "#525252",
              textAlign: "center",
            }}
          >
            {description}
          </div>
        </div>
      </div>
    );
  }

  // USER PROFILE (Start Layout)
  if (hasUser && !hasWorkspace) {
    return (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#ffffff",
          padding: 80,
          fontFamily: "Inter, system-ui, sans-serif",
          color: "#171717",
        }}
      >
        {/* Top Left */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 16,
              fontSize: 56,
              fontWeight: 700,
            }}
          >
            {display_name}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 38,
              color: "#737373",
              fontWeight: 700,
            }}
          >
            @{username}
          </div>
        </div>

        {/* Bottom Left */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Logo size={70} />
            <div
              style={{
                display: "flex",
                fontSize: 42,
                fontWeight: 700,
              }}
            >
              Sheltermark
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: "#525252",
              maxWidth: 600,
              fontWeight: 700,
            }}
          >
            {description}
          </div>
        </div>
      </div>
    );
  }

  // USER + WORKSPACE
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#ffffff",
        padding: 80,
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#171717",
      }}
    >
      {/* Top Left (Workspace replaces display name) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 56,
            fontWeight: 700,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 28,
              height: 28,
              borderRadius: "50%",
              backgroundColor: getPastelHexColor(workspace ?? ""),
            }}
          />
          {workspace}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 38,
            color: "#737373",
            fontWeight: 700,
          }}
        >
          By @{username}
        </div>
      </div>

      {/* Bottom Left (Same as user profile) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Logo size={70} />
          <div
            style={{
              display: "flex",
              fontSize: 42,
              fontWeight: 700,
            }}
          >
            Sheltermark
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "#525252",
            maxWidth: 600,
            fontWeight: 700,
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
}

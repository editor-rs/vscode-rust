/**
 * The enumeration contains possible configurations supported by Visual Studio Code
 */
enum UserOrWorkspaceConfiguration {
    /**
     * It's also known as Global Settings, Installation-wide Settings. Properties stored in the
     * configuration have low precedence, but they are taken into account when the workspace
     * configuration doesn't define the corresponding properties
     */
    User,
    /**
     * The configuration for the current workspace
     */
    Workspace
}

// That's the only way to make an enum exported by default.
// See https://github.com/Microsoft/TypeScript/issues/3792
export default UserOrWorkspaceConfiguration;

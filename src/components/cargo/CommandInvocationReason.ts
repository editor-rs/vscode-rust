/**
 * Possible reasons of a cargo command invocation
 */
export enum CommandInvocationReason {
    /**
     * The command is invoked because the action on save is to execute the command
     */
    ActionOnSave,
    /**
     * The command is invoked because the corresponding registered command is executed
     */
    CommandExecution
}

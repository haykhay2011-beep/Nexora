import { FunctionDeclaration, Type } from '@google/genai';
import { listRecentEmails, readEmail, draftReply, sendEmail, markEmailRead, archiveEmail } from './emailTools';
import { listTodayEvents, createCalendarEvent } from './calendarTools';
import { listTasks, createTask, completeTask } from './taskTools';
import { getAccountBalances, getRecentTransactions } from './financeTools';
import { createReminder, listReminders } from './reminderTools';

export type ToolHandler = (userId: string, args: any) => Promise<string>;

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'listRecentEmails',
    description:
      "Lists the user's most recent inbox emails (subject, sender, date, snippet) from whichever email " +
      'provider (Google or Yahoo) they currently have connected.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        maxResults: {
          type: Type.NUMBER,
          description: 'How many recent emails to return. Defaults to 10.',
        },
      },
    },
  },
  {
    name: 'readEmail',
    description: 'Reads the full body of a single email by its message id, as returned by listRecentEmails.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        messageId: { type: Type.STRING, description: 'The id of the email to read.' },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'draftReply',
    description: 'Saves a draft reply to an existing email for the user to review and send themselves.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        messageId: { type: Type.STRING, description: 'The id of the email being replied to.' },
        body: { type: Type.STRING, description: 'The plain-text body of the reply.' },
      },
      required: ['messageId', 'body'],
    },
  },
  {
    name: 'listTodayEvents',
    description: "Lists all of the user's Google Calendar events for today.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'createCalendarEvent',
    description: 'Creates a new event on the user\'s Google Calendar.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: 'The event title.' },
        startIso: { type: Type.STRING, description: 'Start time as an ISO 8601 datetime.' },
        endIso: { type: Type.STRING, description: 'End time as an ISO 8601 datetime.' },
        description: { type: Type.STRING, description: 'Optional event description.' },
        attendees: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Optional list of attendee email addresses.',
        },
      },
      required: ['summary', 'startIso', 'endIso'],
    },
  },
  {
    name: 'listTasks',
    description: "Lists the user's incomplete Google Tasks.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'createTask',
    description: 'Creates a new Google Task for the user.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'The task title.' },
        notes: { type: Type.STRING, description: 'Optional additional notes.' },
        dueIso: { type: Type.STRING, description: 'Optional due date as an ISO 8601 date.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'completeTask',
    description: 'Marks an existing Google Task as completed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskId: { type: Type.STRING, description: 'The id of the task to complete.' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'getAccountBalances',
    description: "Fetches the user's bank account balances via their connected Plaid account.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'getRecentTransactions',
    description: "Fetches the user's recent bank transactions via their connected Plaid account.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        days: { type: Type.NUMBER, description: 'How many days back to look. Defaults to 7.' },
      },
    },
  },
  {
    name: 'sendEmail',
    description: 'Sends a brand new email on the user\'s behalf (not a reply). Only use after the user confirms the recipient, subject, and body.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: { type: Type.STRING, description: 'Recipient email address.' },
        subject: { type: Type.STRING, description: 'Email subject line.' },
        body: { type: Type.STRING, description: 'Plain-text email body.' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'markEmailRead',
    description: 'Marks an email as read.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        messageId: { type: Type.STRING, description: 'The id of the email to mark as read.' },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'archiveEmail',
    description: "Archives an email, removing it from the user's inbox.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        messageId: { type: Type.STRING, description: 'The id of the email to archive.' },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'createReminder',
    description: "Creates a reminder that Jarvis will proactively surface to the user once it's due (e.g. \"remind me to call mom tomorrow at 5pm\").",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: 'What to remind the user about.' },
        dueIso: { type: Type.STRING, description: 'When to surface the reminder, as an ISO 8601 datetime.' },
      },
      required: ['text', 'dueIso'],
    },
  },
  {
    name: 'listReminders',
    description: "Lists the user's upcoming, not-yet-completed reminders.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

export const toolHandlers: Record<string, ToolHandler> = {
  listRecentEmails: (userId, args) => listRecentEmails(userId, args ?? {}),
  readEmail: (userId, args) => readEmail(userId, args ?? {}),
  draftReply: (userId, args) => draftReply(userId, args ?? {}),
  listTodayEvents: (userId) => listTodayEvents(userId),
  createCalendarEvent: (userId, args) => createCalendarEvent(userId, args ?? {}),
  listTasks: (userId) => listTasks(userId),
  createTask: (userId, args) => createTask(userId, args ?? {}),
  completeTask: (userId, args) => completeTask(userId, args ?? {}),
  getAccountBalances: (userId) => getAccountBalances(userId),
  getRecentTransactions: (userId, args) => getRecentTransactions(userId, args ?? {}),
  sendEmail: (userId, args) => sendEmail(userId, args ?? {}),
  markEmailRead: (userId, args) => markEmailRead(userId, args ?? {}),
  archiveEmail: (userId, args) => archiveEmail(userId, args ?? {}),
  createReminder: (userId, args) => createReminder(userId, args ?? {}),
  listReminders: (userId) => listReminders(userId),
};

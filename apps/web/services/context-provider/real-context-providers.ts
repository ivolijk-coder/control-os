import 'server-only';

import { prisma } from '@/lib/prisma';
import { listPendingConversationTasks } from '@/services/conversation-tasks/conversation-task.service';
import { getDocumentContextSummary } from '@/services/documents/persistent-document.service';
import type {
  DocumentsContextProvider,
  OperationalTasksContextProvider,
  UserProfileProvider,
} from './context-provider.interfaces';

export const userProfileProvider: UserProfileProvider = {
  async getProfile(userId) {
    return prisma.appUser.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  },
};

export const documentsContextProvider: DocumentsContextProvider = {
  async getDocumentsContext(userId) {
    return getDocumentContextSummary(userId);
  },
};

export const operationalTasksContextProvider: OperationalTasksContextProvider = {
  async getOperationalTasksContext(userId) {
    const tasks = await listPendingConversationTasks(userId);
    return {
      pending: tasks.filter((task) => task.status === 'PENDING').length,
      waitingUser: tasks.filter((task) => task.status === 'WAITING_USER').length,
    };
  },
};

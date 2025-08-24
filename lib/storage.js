class Storage {
  async get(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  async set(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, resolve);
    });
  }

  async remove(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, resolve);
    });
  }

  async clear() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  }

  // Utility methods for library operations
  async createFolder(name, parentId = 'fld_root') {
    const data = await this.get(['folders']);
    const folderId = 'fld_' + Date.now();
    
    const newFolder = {
      id: folderId,
      name,
      parentId,
      childFolderIds: [],
      promptIds: [],
      createdAt: Date.now()
    };

    data.folders.push(newFolder);
    
    // Add to parent folder if not root
    if (parentId !== 'fld_root') {
      const parentFolder = data.folders.find(f => f.id === parentId);
      if (parentFolder) {
        parentFolder.childFolderIds.push(folderId);
      }
    }

    await this.set({ folders: data.folders });
    return newFolder;
  }

  async deleteFolder(folderId) {
    const data = await this.get(['folders', 'prompts']);
    const folder = data.folders.find(f => f.id === folderId);
    
    if (!folder) return;

    // Delete all prompts in folder
    for (const promptId of folder.promptIds) {
      delete data.prompts[promptId];
    }

    // Recursively delete child folders
    for (const childFolderId of folder.childFolderIds) {
      await this.deleteFolder(childFolderId);
    }

    // Remove from parent folder
    if (folder.parentId) {
      const parentFolder = data.folders.find(f => f.id === folder.parentId);
      if (parentFolder) {
        parentFolder.childFolderIds = parentFolder.childFolderIds.filter(id => id !== folderId);
      }
    }

    // Remove folder itself
    data.folders = data.folders.filter(f => f.id !== folderId);

    await this.set({ folders: data.folders, prompts: data.prompts });
  }

  async createPrompt(title, body, parentFolderId = 'fld_root') {
    const data = await this.get(['folders', 'prompts']);
    const promptId = 'prm_' + Date.now();
    
    const newPrompt = {
      id: promptId,
      title,
      body,
      parentFolderId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    data.prompts[promptId] = newPrompt;
    
    // Add to parent folder
    const parentFolder = data.folders.find(f => f.id === parentFolderId);
    if (parentFolder) {
      parentFolder.promptIds.push(promptId);
    }

    await this.set({ folders: data.folders, prompts: data.prompts });
    return newPrompt;
  }

  async updatePrompt(promptId, updates) {
    const data = await this.get(['prompts']);
    if (data.prompts[promptId]) {
      data.prompts[promptId] = {
        ...data.prompts[promptId],
        ...updates,
        updatedAt: Date.now()
      };
      await this.set({ prompts: data.prompts });
    }
  }

  async deletePrompt(promptId) {
    const data = await this.get(['folders', 'prompts']);
    const prompt = data.prompts[promptId];
    
    if (!prompt) return;

    // Remove from parent folder
    const parentFolder = data.folders.find(f => f.id === prompt.parentFolderId);
    if (parentFolder) {
      parentFolder.promptIds = parentFolder.promptIds.filter(id => id !== promptId);
    }

    delete data.prompts[promptId];
    await this.set({ folders: data.folders, prompts: data.prompts });
  }
}

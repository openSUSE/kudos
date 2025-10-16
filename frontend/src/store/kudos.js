// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { defineStore } from "pinia";
import axios from "axios";

export const useKudosStore = defineStore("kudos", {
  state: () => ({
    kudos: [],
    total: 0,
    page: 1,
    pageSize: 50,
    loading: false,
    error: null
  }),

  actions: {
    async fetchAll(page = 1) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await axios.get(`/api/kudos?page=${page}&limit=${this.pageSize}`);
        this.kudos = data.kudos;
        this.total = data.total;
        this.page = page;
      } catch (err) {
        console.error("Failed to fetch kudos:", err);
        this.error = err.message || "Failed to load kudos.";
      } finally {
        this.loading = false;
      }
    },

    async sendKudo({ to, category, message }) {
      try {
        const { data } = await axios.post("/api/kudos", {
          to,
          category,
          message,
        });
        this.kudos.unshift(data);
        return true;
      } catch (err) {
        console.error("Failed to send kudo:", err);
        return false;
      }
    }
  }
});

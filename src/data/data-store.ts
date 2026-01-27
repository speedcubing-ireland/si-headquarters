import { create } from 'zustand'

type DataStore = {};

export const useData = create<DataStore>();
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import type { RootState } from "../store";
import { unapply } from "lodash/fp";

// Define a type for the slice state
interface FilterState {
  project: string | undefined;
  context: string | undefined;
  starredDesc: string[];
}

// Define the initial state using that type
const initialState: FilterState = {
  project: undefined,
  context: undefined,
  starredDesc: [],
};

export const filterSlice = createSlice({
  name: "projectFilter",
  initialState,
  reducers: {
    setProject: (state, action: PayloadAction<string>) => {
      if (state.project) {
        state.project = undefined;
      } else {
        state.project = action.payload;
      }
    },
    setContext: (state, action: PayloadAction<string>) => {
      if (state.context) {
        state.context = undefined;
      } else {
        state.context = action.payload;
      }
    },
    unsetProject: (state) => {
      state.project = undefined;
    },
    unsetContext: (state) => {
      state.context = undefined;
    },
    star: (state, action: PayloadAction<string>) => {
      if (state.starredDesc.includes(action.payload)) {
        state.starredDesc = state.starredDesc.filter(
          (s) => s != action.payload
        );
      } else {
        state.starredDesc = [...state.starredDesc, action.payload];
      }
    },
  },
});

// Action creators are generated for each case reducer function
export const { setProject, unsetProject, setContext, unsetContext, star } =
  filterSlice.actions;

export default filterSlice.reducer;

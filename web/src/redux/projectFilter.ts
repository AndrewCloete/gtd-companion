import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import type { RootState } from "../store";

// Define a type for the slice state
interface ProjectFilterState {
  value: string | undefined;
}

// Define the initial state using that type
const initialState: ProjectFilterState = {
  value: undefined,
};

export const projectFilterSlice = createSlice({
  name: "projectFilter",
  initialState,
  reducers: {
    set: (state, action: PayloadAction<string>) => {
      state.value = action.payload;
    },
    unset: (state) => {
      state.value = undefined;
    },
  },
});

// Action creators are generated for each case reducer function
export const { set, unset } = projectFilterSlice.actions;

export default projectFilterSlice.reducer;
